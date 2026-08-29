defmodule KaarobarWeb.Plugs.ValidateIdParams do
  @moduledoc """
  Rejects malformed identifiers before they reach a query.

  Ecto raises `Ecto.Query.CastError` when a value that is not a UUID reaches a
  `where` clause on a `binary_id` column. Without this plug a mistyped URL, a
  stale bookmark or an automated probe returns 500 and an alert, when the
  honest answer is 404.

  Checks every parameter named `id`, or ending in `_id` or `_ids` — path,
  query and body alike, since Phoenix merges them all into `conn.params`.
  """

  @behaviour Plug

  import Plug.Conn

  alias Kaarobar.Ecto.UUIDv7
  alias KaarobarWeb.ErrorEnvelope

  @impl Plug
  def init(opts), do: opts

  @impl Plug
  def call(conn, _opts) do
    case Enum.find(conn.params, &invalid?/1) do
      nil -> conn
      {key, _value} -> reject(conn, key)
    end
  end

  defp invalid?({key, value}) do
    id_param?(key) and not valid_value?(value)
  end

  defp id_param?(key) when is_binary(key) do
    key == "id" or String.ends_with?(key, "_id") or String.ends_with?(key, "_ids")
  end

  defp id_param?(_key), do: false

  # `nil` and `""` mean "not supplied" and are the changesets' business, not
  # ours — a missing required field should be a validation error naming the
  # field, not a bare 404.
  defp valid_value?(nil), do: true
  defp valid_value?(""), do: true
  defp valid_value?(values) when is_list(values), do: Enum.all?(values, &valid_value?/1)
  defp valid_value?(value), do: UUIDv7.valid?(value)

  defp reject(conn, key) do
    {status, body} =
      ErrorEnvelope.for_reason(:not_found)
      |> then(fn {status, body} ->
        {status, put_in(body, [:error, :details], %{key => ["is not a valid identifier"]})}
      end)

    conn
    |> put_resp_content_type("application/json")
    |> send_resp(Plug.Conn.Status.code(status), Jason.encode_to_iodata!(body))
    |> halt()
  end
end
