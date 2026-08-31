defmodule KaarobarWeb.QuoteController do
  @moduledoc """
  Quotes, and the time recorded against the work they turn into.

  Accepting a quote opens the work, not a sale. `unbilled` is what a billing
  run reads: the time that can still go on an invoice.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Professional

  plug KaarobarWeb.Plugs.Authorize, module: "quotes"

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "quote:view"] when action in [:index, :show, :win_rate]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "quote:manage"]
       when action in [:create, :set_lines, :send_quote, :accept, :decline]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "time_entry:view"] when action in [:time, :unbilled, :utilisation]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "time_entry:record"]
       when action in [:log_time, :update_time, :delete_time]

  # --- Quotes -----------------------------------------------------------------

  def index(conn, params) do
    opts =
      []
      |> maybe_put(:status, params["status"])
      |> maybe_put(:customer_id, params["customer_id"])

    render(conn, :quotes, quotes: Professional.list_quotes(conn.assigns.scope, opts))
  end

  def show(conn, %{"id" => id}) do
    with {:ok, quote} <- Professional.fetch_quote(conn.assigns.scope, id) do
      render(conn, :quote, quote: quote)
    end
  end

  def create(conn, params) do
    with {:ok, quote} <- Professional.create_quote(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:quote, quote: quote)
    end
  end

  def set_lines(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, quote} <- Professional.fetch_quote(scope, id),
         {:ok, repriced} <- Professional.set_quote_lines(scope, quote, params["lines"] || []) do
      render(conn, :quote, quote: repriced)
    end
  end

  def send_quote(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, quote} <- Professional.fetch_quote(scope, id),
         {:ok, sent} <- Professional.send_quote(scope, quote),
         {:ok, reloaded} <- Professional.fetch_quote(scope, sent.id) do
      render(conn, :quote, quote: reloaded)
    end
  end

  @doc "The customer said yes: opens the work. The sale comes later."
  def accept(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, quote} <- Professional.fetch_quote(scope, id),
         {:ok, accepted} <- Professional.accept_quote(scope, quote),
         {:ok, reloaded} <- Professional.fetch_quote(scope, accepted.id) do
      render(conn, :quote, quote: reloaded)
    end
  end

  def decline(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, quote} <- Professional.fetch_quote(scope, id),
         {:ok, declined} <- Professional.decline_quote(scope, quote, params["reason"]),
         {:ok, reloaded} <- Professional.fetch_quote(scope, declined.id) do
      render(conn, :quote, quote: reloaded)
    end
  end

  @doc "How many quotes turned into work, and what that was worth."
  def win_rate(conn, params) do
    with {:ok, from} <- parse_date(params["from"]),
         {:ok, to} <- parse_date(params["to"]) do
      render(conn, :win_rate, stats: Professional.win_rate(conn.assigns.scope, from, to))
    end
  end

  # --- Time -------------------------------------------------------------------

  def time(conn, params) do
    opts =
      []
      |> maybe_put(:user_id, params["user_id"])
      |> maybe_put(:customer_id, params["customer_id"])
      |> maybe_put(:service_job_id, params["service_job_id"])
      |> maybe_put(:from, parse_date_or_nil(params["from"]))
      |> maybe_put(:to, parse_date_or_nil(params["to"]))

    render(conn, :time_entries, entries: Professional.list_time(conn.assigns.scope, opts))
  end

  def log_time(conn, params) do
    with {:ok, entry} <- Professional.log_time(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:time_entry, entry: entry)
    end
  end

  def update_time(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, entry} <- Professional.fetch_time(scope, id),
         {:ok, updated} <- Professional.update_time(scope, entry, params) do
      render(conn, :time_entry, entry: updated)
    end
  end

  def delete_time(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, entry} <- Professional.fetch_time(scope, id),
         {:ok, deleted} <- Professional.delete_time(scope, entry) do
      render(conn, :time_entry, entry: deleted)
    end
  end

  @doc "What can still go on an invoice, and what it is worth."
  def unbilled(conn, params) do
    opts =
      []
      |> maybe_put(:customer_id, params["customer_id"])
      |> maybe_put(:service_job_id, params["service_job_id"])

    render(conn, :unbilled, result: Professional.unbilled(conn.assigns.scope, opts))
  end

  @doc "Hours per person, billable and not — the utilisation figure."
  def utilisation(conn, params) do
    with {:ok, from} <- parse_date(params["from"]),
         {:ok, to} <- parse_date(params["to"]) do
      render(conn, :utilisation, rows: Professional.utilisation(conn.assigns.scope, from, to))
    end
  end

  defp parse_date(value) when is_binary(value) do
    case Date.from_iso8601(value) do
      {:ok, date} -> {:ok, date}
      {:error, _reason} -> {:error, :invalid_date}
    end
  end

  defp parse_date(_value), do: {:error, :invalid_date}

  defp parse_date_or_nil(value) do
    case parse_date(value) do
      {:ok, date} -> date
      {:error, _reason} -> nil
    end
  end

  defp maybe_put(opts, _key, nil), do: opts
  defp maybe_put(opts, key, value), do: Keyword.put(opts, key, value)
end
