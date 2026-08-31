defmodule KaarobarWeb.CacheBodyReader do
  @moduledoc """
  Keeps the raw request body so a webhook signature can be checked against it.

  ## Why the parsed body is useless here

  A gateway signs the exact bytes it sent. Re-encoding the parsed JSON produces
  different bytes — key order changes, whitespace goes, numbers get
  reformatted — and a signature computed over different bytes never matches. So
  the body has to be captured before `Plug.Parsers` consumes it, because after
  that it is gone.

  ## Only on the webhook paths

  Holding every request body in memory would double the cost of a bulk catalog
  import for no reason. The reader keeps a copy only where a signature is
  actually going to be checked, and reads straight through everywhere else.
  """

  @doc false
  def read_body(conn, opts) do
    case Plug.Conn.read_body(conn, opts) do
      {:ok, body, conn} -> {:ok, body, maybe_cache(conn, body)}
      {:more, body, conn} -> {:more, body, maybe_cache(conn, body)}
      {:error, reason} -> {:error, reason}
    end
  end

  # Webhook paths only. Everything else reads straight through, so a 20MB
  # catalog import is not held twice.
  defp maybe_cache(conn, body) do
    if webhook_path?(conn.request_path) do
      Plug.Conn.assign(conn, :raw_body, cached(conn) <> body)
    else
      conn
    end
  end

  defp cached(conn), do: conn.assigns[:raw_body] || ""

  defp webhook_path?(path), do: String.contains?(path, "/webhooks/")
end
