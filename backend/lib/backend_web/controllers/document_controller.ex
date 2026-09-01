defmodule KaarobarWeb.DocumentController do
  @moduledoc """
  Printable documents, rendered server-side.

  ## Not JSON

  These actions send `text/html` and `application/octet-stream` rather than the
  usual envelope. A receipt is a document, not a resource, and wrapping a
  20 kB HTML page in a JSON string would make every client unwrap it before it
  could do the one thing it wants to do with it.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Documents

  plug KaarobarWeb.Plugs.Authorize, [permission: "sale:reprint"] when action in [:receipt]

  @doc """
  A sale receipt.

  `format=html` (the default) returns a printable page; `format=escpos`
  returns the raw bytes for a thermal printer. `paper` picks the roll or sheet
  size, and `language` overrides the shop's own setting — for a customer who
  asks for an English copy of an Urdu receipt.
  """
  def receipt(conn, %{"sale_id" => sale_id} = params) do
    scope = conn.assigns.scope
    opts = options(params)

    case params["format"] do
      "escpos" -> send_escpos(conn, scope, sale_id, opts)
      _html -> send_html(conn, scope, sale_id, opts)
    end
  end

  defp send_html(conn, scope, sale_id, opts) do
    with {:ok, html} <- Documents.receipt_html(scope, sale_id, opts) do
      conn
      |> put_resp_content_type("text/html")
      |> send_resp(200, html)
    end
  end

  defp send_escpos(conn, scope, sale_id, opts) do
    case Documents.receipt_escpos(scope, sale_id, opts) do
      {:ok, bytes} ->
        conn
        # Opaque on purpose: the client forwards these to a printer and must
        # not try to decode them as text on the way.
        |> put_resp_content_type("application/octet-stream")
        |> put_resp_header("content-disposition", ~s(attachment; filename="receipt.bin"))
        |> send_resp(200, bytes)

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp options(params) do
    []
    |> put_present(:paper, params["paper"])
    |> put_present(:language, params["language"])
  end

  defp put_present(opts, _key, nil), do: opts
  defp put_present(opts, _key, ""), do: opts
  defp put_present(opts, key, value), do: Keyword.put(opts, key, value)
end
