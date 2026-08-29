defmodule KaarobarWeb.Pagination do
  @moduledoc """
  Cursor pagination for list endpoints.

  Offset pagination is not offered. A cashier scrolling sales history while new
  sales are being rung up would see rows shift between pages, and `OFFSET
  50000` degrades badly on the tables that grow fastest. A cursor is stable
  under concurrent writes and costs the same on page 1 and page 1000.

  Because primary keys are `Kaarobar.Ecto.UUIDv7` and therefore time-ordered,
  the id column doubles as the cursor: paging by id *is* paging by insertion
  time, with no secondary sort column and no ambiguity between rows sharing a
  timestamp.

      {sales, meta} = Pagination.page(query, params)

  Responses carry `meta`:

      {"data": [...], "meta": {"limit": 50, "has_more": true, "next_cursor": "0195..."}}
  """

  import Ecto.Query

  alias Kaarobar.Repo

  @default_limit 50
  @max_limit 200

  @type meta :: %{limit: pos_integer(), has_more: boolean(), next_cursor: String.t() | nil}

  @doc """
  Runs a paginated query and returns `{entries, meta}`.

  ## Options

    * `:cursor_field` — the column to page on. Defaults to `:id`.
    * `:direction` — `:desc` (newest first, the default) or `:asc`.
    * `:repo_opts` — options forwarded to `Repo.all/2`.
  """
  @spec page(Ecto.Queryable.t(), map(), keyword()) :: {[struct()], meta()}
  def page(queryable, params, opts \\ []) do
    limit = parse_limit(params)
    field_name = Keyword.get(opts, :cursor_field, :id)
    direction = Keyword.get(opts, :direction, :desc)

    rows =
      queryable
      |> apply_cursor(params_cursor(params), field_name, direction)
      |> exclude(:order_by)
      |> order_by([record], [{^direction, field(record, ^field_name)}])
      |> limit(^(limit + 1))
      |> Repo.all(Keyword.get(opts, :repo_opts, []))

    split(rows, limit, field_name)
  end

  @doc """
  The limit this request asked for, clamped to a sane range.
  """
  @spec parse_limit(map()) :: pos_integer()
  def parse_limit(params) do
    params
    |> fetch_param(["limit", "per_page"])
    |> to_integer()
    |> case do
      nil -> @default_limit
      value when value < 1 -> 1
      value when value > @max_limit -> @max_limit
      value -> value
    end
  end

  defp split(rows, limit, field_name) do
    if length(rows) > limit do
      entries = Enum.take(rows, limit)
      next = entries |> List.last() |> Map.fetch!(field_name)
      {entries, %{limit: limit, has_more: true, next_cursor: next}}
    else
      {rows, %{limit: limit, has_more: false, next_cursor: nil}}
    end
  end

  defp apply_cursor(queryable, nil, _field_name, _direction), do: queryable

  defp apply_cursor(queryable, cursor, field_name, :desc) do
    where(queryable, [record], field(record, ^field_name) < ^cursor)
  end

  defp apply_cursor(queryable, cursor, field_name, :asc) do
    where(queryable, [record], field(record, ^field_name) > ^cursor)
  end

  defp params_cursor(params) do
    case fetch_param(params, ["cursor", "after"]) do
      "" -> nil
      value -> value
    end
  end

  defp fetch_param(params, keys) when is_map(params) do
    Enum.find_value(keys, fn key -> params[key] end)
  end

  defp fetch_param(_params, _keys), do: nil

  defp to_integer(nil), do: nil
  defp to_integer(value) when is_integer(value), do: value

  defp to_integer(value) when is_binary(value) do
    case Integer.parse(value) do
      {parsed, _rest} -> parsed
      :error -> nil
    end
  end

  defp to_integer(_value), do: nil
end
