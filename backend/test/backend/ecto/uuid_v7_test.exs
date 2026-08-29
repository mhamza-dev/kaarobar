defmodule Kaarobar.Ecto.UUIDv7Test do
  use ExUnit.Case, async: true

  alias Kaarobar.Ecto.UUIDv7

  describe "generate/0" do
    test "produces a value Ecto.UUID accepts" do
      uuid = UUIDv7.generate()

      assert {:ok, ^uuid} = Ecto.UUID.cast(uuid)
      assert {:ok, <<_::128>>} = Ecto.UUID.dump(uuid)
    end

    test "sets the version to 7 and the RFC 9562 variant" do
      assert <<_ts::48, version::4, _rand_a::12, variant::2, _rand_b::62>> = UUIDv7.bingenerate()

      assert version == 7
      assert variant == 2
    end

    test "produces distinct values" do
      generated = for _index <- 1..1_000, do: UUIDv7.generate()

      assert generated |> Enum.uniq() |> length() == 1_000
    end
  end

  describe "time ordering" do
    test "values generated later sort after values generated earlier" do
      earlier = UUIDv7.generate()
      # The timestamp has millisecond resolution, so force a tick.
      Process.sleep(2)
      later = UUIDv7.generate()

      assert earlier < later
    end

    test "raw binaries sort the same way, which is what the index sees" do
      earlier = UUIDv7.bingenerate()
      Process.sleep(2)
      later = UUIDv7.bingenerate()

      assert earlier < later
    end
  end

  describe "timestamp/1" do
    test "recovers the generation time from a v7 value" do
      before = DateTime.utc_now()
      uuid = UUIDv7.generate()

      assert {:ok, extracted} = UUIDv7.timestamp(uuid)
      # Truncation to whole milliseconds can place it a hair before `before`.
      assert DateTime.diff(extracted, before, :millisecond) |> abs() < 1_000
    end

    test "accepts the raw binary form" do
      raw = UUIDv7.bingenerate()

      assert {:ok, %DateTime{}} = UUIDv7.timestamp(raw)
    end

    test "refuses a v4 UUID rather than reporting a meaningless time" do
      assert :error = UUIDv7.timestamp(Ecto.UUID.generate())
    end
  end

  describe "Ecto.Type behaviour" do
    test "casts, dumps and loads like Ecto.UUID" do
      uuid = UUIDv7.generate()

      assert UUIDv7.type() == :uuid
      assert {:ok, ^uuid} = UUIDv7.cast(uuid)
      assert {:ok, dumped} = UUIDv7.dump(uuid)
      assert {:ok, ^uuid} = UUIDv7.load(dumped)
    end

    test "rejects a value that is not a UUID" do
      assert :error = UUIDv7.cast("not-a-uuid")
    end
  end
end
