defmodule Kaarobar.Ecto.UUIDv7 do
  @moduledoc """
  A UUID version 7 primary key type (RFC 9562).

  Behaves exactly like `Ecto.UUID` for casting, loading and dumping — the same
  `uuid` column type, the same textual representation — but generates
  time-ordered values instead of purely random ones.

  This matters at POS scale. The high-write tables in this system (`sales`,
  `sale_items`, `stock_moves`, `audit_logs`) are append-heavy and are almost
  always read in time order. Random v4 keys scatter inserts across the whole
  primary-key B-tree, which inflates the index and hurts cache locality; v7
  keys append to the right-hand edge and keep recent rows physically close.

  Layout:

      0                   1                   2                   3
      0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
     +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
     |                          unix_ts_ms                           |
     +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
     |          unix_ts_ms           |  ver  |       rand_a          |
     +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
     |var|                        rand_b                             |
     +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
     |                            rand_b                             |
     +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+

  Values remain unguessable: 74 bits come from `:crypto.strong_rand_bytes/1`.
  """

  use Ecto.Type

  @version 7
  @variant 2

  @impl Ecto.Type
  def type, do: :uuid

  @impl Ecto.Type
  def cast(value), do: Ecto.UUID.cast(value)

  @impl Ecto.Type
  def dump(value), do: Ecto.UUID.dump(value)

  @impl Ecto.Type
  def load(value), do: Ecto.UUID.load(value)

  @impl Ecto.Type
  def autogenerate, do: generate()

  @doc """
  Generates a version 7 UUID in its human-readable string form.
  """
  @spec generate() :: Ecto.UUID.t()
  def generate, do: bingenerate() |> Ecto.UUID.load!()

  @doc """
  Generates a version 7 UUID as a raw 16-byte binary.
  """
  @spec bingenerate() :: binary()
  def bingenerate do
    timestamp_ms = System.system_time(:millisecond)
    <<rand_a::12, rand_b::62, _rest::6>> = :crypto.strong_rand_bytes(10)

    <<timestamp_ms::big-unsigned-48, @version::4, rand_a::12, @variant::2, rand_b::62>>
  end

  @doc """
  True when the value is a well-formed UUID of any version.

  Every `fetch_*` in a context runs this before building a query. Ecto raises
  `Ecto.Query.CastError` when a malformed id reaches a `where` clause, which
  would turn a mistyped URL — or a probe — into a 500 instead of a 404.
  """
  @spec valid?(term()) :: boolean()
  def valid?(value) when is_binary(value), do: match?({:ok, _uuid}, Ecto.UUID.cast(value))
  def valid?(_value), do: false

  @doc """
  Extracts the embedded millisecond timestamp from a version 7 UUID.

  Returns `:error` for any other UUID version, so callers cannot accidentally
  read a meaningless timestamp out of a v4 value.
  """
  @spec timestamp(Ecto.UUID.t() | binary()) :: {:ok, DateTime.t()} | :error
  def timestamp(uuid) when is_binary(uuid) do
    with {:ok, <<timestamp_ms::big-unsigned-48, @version::4, _rest::76>>} <- to_raw(uuid) do
      DateTime.from_unix(timestamp_ms, :millisecond)
    else
      _other -> :error
    end
  end

  defp to_raw(<<_::128>> = raw), do: {:ok, raw}
  defp to_raw(string) when is_binary(string), do: Ecto.UUID.dump(string)
end
