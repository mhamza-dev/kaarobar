defmodule KaarobarWeb.RegulatedController do
  @moduledoc """
  The register a pesticide dealer or pharmacy has to keep.

  Read-only over HTTP, on purpose. Entries are written by checkout and the
  table refuses updates and deletes — a register the shop could edit through an
  API would be worth exactly as much to an inspector as one it could edit in
  the database.

  `batch` is the recall endpoint: it names everyone who bought from an affected
  batch, which is the only question a recall asks.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Regulated

  plug KaarobarWeb.Plugs.Authorize, module: "batches"

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "regulated:view"] when action in [:index, :batch, :products]

  def index(conn, params) do
    opts =
      []
      |> maybe_put(:from, parse_date(params["from"]))
      |> maybe_put(:to, parse_date(params["to"]))
      |> maybe_put(:product_id, params["product_id"])
      |> maybe_put(:customer_id, params["customer_id"])

    render(conn, :register, entries: Regulated.register(conn.assigns.scope, opts))
  end

  @doc "Everyone who bought from a batch. The recall list."
  def batch(conn, %{"batch_id" => batch_id}) do
    render(conn, :register, entries: Regulated.buyers_of_batch(conn.assigns.scope, batch_id))
  end

  @doc "The restricted products this shop sells."
  def products(conn, _params) do
    render(conn, :products, products: Regulated.restricted_products(conn.assigns.scope))
  end

  defp parse_date(nil), do: nil

  defp parse_date(value) when is_binary(value) do
    case Date.from_iso8601(value) do
      {:ok, date} -> date
      {:error, _reason} -> nil
    end
  end

  defp parse_date(_value), do: nil

  defp maybe_put(opts, _key, nil), do: opts
  defp maybe_put(opts, key, value), do: Keyword.put(opts, key, value)
end
