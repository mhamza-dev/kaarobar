defmodule KaarobarWeb.Controllers.Helpers.ListFilters do
  @moduledoc false

  import Ecto.Query, only: [limit: 2, offset: 2]

  @doc """
  Parse common list filter query params into keyword opts for context list functions.

  Supports `q`, `from`, `to`, `status`, `active`, category filters, numeric ranges
  (`amount_min`/`amount_max`, `balance_min`/`balance_max`, `credit_limit_min`/`credit_limit_max`),
  `payment_method` (CSV), and pagination (`limit`, `cursor` offset-style).
  """
  @default_allowed [
    :q,
    :from,
    :to,
    :status,
    :active,
    :category_id,
    :category_ids,
    :category,
    :product_kind,
    :source,
    :portal_enabled,
    :credit_enabled,
    :khata_enabled,
    :amount_min,
    :amount_max,
    :balance_min,
    :balance_max,
    :credit_limit_min,
    :credit_limit_max,
    :payment_method,
    :limit,
    :cursor
  ]

  def parse(params, allowed \\ @default_allowed) do
    allowed
    |> Enum.reduce([], fn key, acc ->
      case {key, Map.get(params, Atom.to_string(key))} do
        {_k, nil} ->
          acc

        {_k, ""} ->
          acc

        {:q, v} ->
          Keyword.put(acc, :q, String.trim(v))

        {:status, v} ->
          Keyword.put(acc, :status, String.trim(v))

        {:source, v} ->
          Keyword.put(acc, :source, String.trim(v))

        {:category, v} ->
          Keyword.put(acc, :category, String.trim(v))

        {:category_id, v} ->
          Keyword.put(acc, :category_id, String.trim(v))

        {:product_kind, v} ->
          Keyword.put(acc, :product_kind, String.trim(v))

        {:from, v} ->
          put_bound(acc, :from, v, :start)

        {:to, v} ->
          put_bound(acc, :to, v, :end)

        {:active, v} ->
          put_bool(acc, :active, v)

        {:portal_enabled, v} ->
          put_bool(acc, :portal_enabled, v)

        {:credit_enabled, v} ->
          put_bool(acc, :credit_enabled, v)

        {:khata_enabled, v} ->
          put_bool(acc, :khata_enabled, v)

        {:category_ids, v} ->
          put_ids(acc, :category_ids, v)

        {:amount_min, v} ->
          put_decimal(acc, :amount_min, v)

        {:amount_max, v} ->
          put_decimal(acc, :amount_max, v)

        {:balance_min, v} ->
          put_decimal(acc, :balance_min, v)

        {:balance_max, v} ->
          put_decimal(acc, :balance_max, v)

        {:credit_limit_min, v} ->
          put_decimal(acc, :credit_limit_min, v)

        {:credit_limit_max, v} ->
          put_decimal(acc, :credit_limit_max, v)

        {:payment_method, v} ->
          put_csv(acc, :payment_methods, v)

        {:limit, v} ->
          put_int(acc, :limit, v)

        {:cursor, v} ->
          put_int(acc, :cursor, v)

        _ ->
          acc
      end
    end)
    |> maybe_status_as_active()
    |> maybe_categories_alias(params)
  end

  @doc """
  Apply offset/limit pagination to an already-built Ecto query and return
  `%{data: rows, meta: %{limit, next_cursor}}`.

  When `opts` has no `:limit`, returns all rows with `meta.limit` equal to the
  result length and `next_cursor: nil` (backward compatible clients still use `data`).
  """
  def paginate(query, opts, repo \\ Kaarobar.Repo) do
    case Keyword.get(opts, :limit) do
      limit when is_integer(limit) and limit > 0 ->
        limit = min(limit, 200)
        offset = max(Keyword.get(opts, :cursor) || 0, 0)

        rows =
          query
          |> limit(^(limit + 1))
          |> offset(^offset)
          |> repo.all()

        {page, rest} = Enum.split(rows, limit)

        next_cursor =
          if rest == [] do
            nil
          else
            Integer.to_string(offset + limit)
          end

        %{data: page, meta: %{limit: limit, next_cursor: next_cursor}}

      _ ->
        rows = repo.all(query)
        %{data: rows, meta: %{limit: length(rows), next_cursor: nil}}
    end
  end

  defp maybe_status_as_active(opts) do
    case Keyword.get(opts, :status) do
      "active" ->
        opts |> Keyword.delete(:status) |> Keyword.put(:active, true)

      "inactive" ->
        opts |> Keyword.delete(:status) |> Keyword.put(:active, false)

      _ ->
        opts
    end
  end

  defp maybe_categories_alias(opts, params) do
    raw = params["categories"] || params["category_ids"]

    if is_nil(Keyword.get(opts, :category_ids)) and is_binary(raw) and String.trim(raw) != "" do
      ids =
        raw
        |> String.split(",")
        |> Enum.map(&String.trim/1)
        |> Enum.reject(&(&1 == ""))

      Keyword.put(opts, :category_ids, ids)
    else
      opts
    end
  end

  defp put_bool(opts, key, v) do
    case String.downcase(String.trim("#{v}")) do
      "true" -> Keyword.put(opts, key, true)
      "1" -> Keyword.put(opts, key, true)
      "yes" -> Keyword.put(opts, key, true)
      "false" -> Keyword.put(opts, key, false)
      "0" -> Keyword.put(opts, key, false)
      "no" -> Keyword.put(opts, key, false)
      _ -> opts
    end
  end

  defp put_ids(opts, key, v) when is_binary(v) do
    ids =
      v
      |> String.split(",")
      |> Enum.map(&String.trim/1)
      |> Enum.reject(&(&1 == ""))

    Keyword.put(opts, key, ids)
  end

  defp put_ids(opts, key, v) when is_list(v), do: Keyword.put(opts, key, v)
  defp put_ids(opts, _, _), do: opts

  defp put_csv(opts, key, v) when is_binary(v) do
    vals =
      v
      |> String.split(",")
      |> Enum.map(&String.trim/1)
      |> Enum.reject(&(&1 == ""))

    if vals == [], do: opts, else: Keyword.put(opts, key, vals)
  end

  defp put_csv(opts, key, v) when is_list(v),
    do: Keyword.put(opts, key, Enum.map(v, &to_string/1))

  defp put_csv(opts, _, _), do: opts

  defp put_decimal(opts, key, v) do
    case Decimal.parse(String.trim("#{v}")) do
      {dec, _} -> Keyword.put(opts, key, dec)
      :error -> opts
    end
  end

  defp put_int(opts, key, v) when is_integer(v), do: Keyword.put(opts, key, v)

  defp put_int(opts, key, v) do
    case Integer.parse(String.trim("#{v}")) do
      {n, _} when n >= 0 -> Keyword.put(opts, key, n)
      _ -> opts
    end
  end

  defp put_bound(opts, key, str, edge) do
    case parse_datetime_bound(str, edge) do
      nil -> opts
      dt -> Keyword.put(opts, key, dt)
    end
  end

  defp parse_datetime_bound(str, edge) when is_binary(str) do
    str = String.trim(str)

    cond do
      match?({:ok, _}, Date.from_iso8601(str)) ->
        {:ok, date} = Date.from_iso8601(str)
        time = if edge == :start, do: ~T[00:00:00], else: ~T[23:59:59]
        DateTime.new!(date, time, "Etc/UTC")

      match?({:ok, _, _}, DateTime.from_iso8601(str)) ->
        {:ok, dt, _} = DateTime.from_iso8601(str)
        DateTime.truncate(dt, :second)

      match?({:ok, _}, NaiveDateTime.from_iso8601(str)) ->
        {:ok, ndt} = NaiveDateTime.from_iso8601(str)
        DateTime.from_naive!(ndt, "Etc/UTC")

      true ->
        nil
    end
  end

  defp parse_datetime_bound(_, _), do: nil
end
