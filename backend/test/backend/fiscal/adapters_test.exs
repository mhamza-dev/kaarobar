defmodule Kaarobar.Fiscal.AdaptersTest do
  @moduledoc """
  What the adapters build and how they read the answer.

  Nothing here touches the database. These are the parts that are wrong in a
  way no integration test would catch: a renamed field is a rejected invoice, a
  200 carrying a refusal read as an acceptance is a receipt stamped with a
  number that does not exist, and a rejection retried as a failure is an
  endpoint hammered forever.
  """

  use ExUnit.Case, async: true

  alias Kaarobar.Fiscal.Adapter
  alias Kaarobar.Fiscal.Adapters.FBR
  alias Kaarobar.Fiscal.Adapters.Generic
  alias Kaarobar.Fiscal.Config
  alias Kaarobar.FiscalStub

  setup do
    FiscalStub.reset()
    :ok
  end

  defp config(attrs \\ %{}) do
    defaults = %Config{
      adapter: "fbr",
      mode: "test",
      taxpayer_number: "1234567-8",
      pos_id: "POS-1",
      credentials: %{"token" => "secret-token"},
      is_active: true
    }

    struct!(defaults, attrs)
  end

  defp document(attrs \\ %{}) do
    defaults = %{
      kind: "invoice",
      number: "INV-0001",
      issued_at: ~U[2026-08-31 09:15:00.000000Z],
      currency: "PKR",
      subtotal: Decimal.new("1000.00"),
      tax_total: Decimal.new("170.00"),
      discount_total: Decimal.new("0.00"),
      total: Decimal.new("1170.00"),
      buyer: nil,
      lines: [
        %{
          sku: "SKU-1",
          name: "Widget",
          tax_code: "17%",
          quantity: Decimal.new("2"),
          unit_price: Decimal.new("500.00"),
          discount_total: Decimal.new("0.00"),
          net_total: Decimal.new("1000.00"),
          tax_rate: Decimal.new("17"),
          tax_total: Decimal.new("170.00"),
          line_total: Decimal.new("1170.00")
        }
      ]
    }

    Map.merge(defaults, attrs)
  end

  defp generic(attrs \\ %{}) do
    struct!(
      %Config{
        adapter: "generic",
        mode: "test",
        taxpayer_number: "TX-1",
        pos_id: "POS-1",
        endpoint_url: "https://clearance.test/invoices",
        credentials: %{"api_key" => "abc"},
        is_active: true
      },
      attrs
    )
  end

  # `Kaarobar.DataCase` has one of these, but this file deliberately does not
  # use it: nothing here touches the database, and taking a sandbox connection
  # for these would slow the suite down for no reason.
  defp errors_on(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {message, opts} ->
      Regex.replace(~r"%{(\w+)}", message, fn _whole, key ->
        opts |> Keyword.get(String.to_existing_atom(key), "") |> to_string()
      end)
    end)
  end

  # ===========================================================================
  # Backoff
  # ===========================================================================

  describe "retry timing" do
    test "backoff grows with each attempt" do
      assert Adapter.backoff_seconds(0) < Adapter.backoff_seconds(1)
      assert Adapter.backoff_seconds(1) < Adapter.backoff_seconds(2)
      assert Adapter.backoff_seconds(3) < Adapter.backoff_seconds(4)
    end

    test "backoff never drops below fifteen seconds" do
      for attempts <- 0..12 do
        assert Adapter.backoff_seconds(attempts) >= 15
      end
    end

    test "backoff is capped, so a submission never stops being retried" do
      # Unbounded growth is how a queue quietly stops draining: the next
      # attempt ends up scheduled past the point anybody is still watching.
      assert Adapter.backoff_seconds(50) <= 3600
      assert Adapter.backoff_seconds(50) == Adapter.backoff_seconds(9)
    end

    test "attempts are bounded" do
      assert Adapter.max_attempts() > 1
      assert Adapter.max_attempts() < 50
    end
  end

  describe "adapter lookup" do
    test "resolves a configured adapter" do
      assert {:ok, FBR} = Adapter.for_config(config())
      assert {:ok, Generic} = Adapter.for_config(%Config{adapter: "generic"})
    end

    test "refuses one it does not know" do
      assert {:error, :unknown_adapter} = Adapter.for_config(%Config{adapter: "hmrc"})
    end
  end

  # ===========================================================================
  # FBR
  # ===========================================================================

  describe "FBR payload" do
    test "uses the authority's own field names" do
      payload = FBR.build_payload(config(), document())

      # Renaming any of these is a rejected invoice, so they are asserted
      # literally rather than through a helper that could rename them too.
      assert payload["POSID"] == "POS-1"
      assert payload["USIN"] == "INV-0001"
      assert payload["TotalBillAmount"] == 1170.0
      assert payload["TotalSaleValue"] == 1000.0
      assert payload["TotalTaxCharged"] == 170.0
      assert [item] = payload["Items"]
      assert item["ItemCode"] == "SKU-1"
      assert item["TotalAmount"] == 1170.0
    end

    test "sends money as numbers, not decimal structs" do
      payload = FBR.build_payload(config(), document())

      assert is_number(payload["TotalBillAmount"])
      assert Enum.all?(payload["Items"], &is_number(&1["TotalAmount"]))
    end

    test "the USIN is the sale number, so a retry cannot file twice" do
      first = FBR.build_payload(config(), document())
      second = FBR.build_payload(config(), document())

      assert first["USIN"] == second["USIN"]
    end

    test "date is their format, not ISO 8601" do
      payload = FBR.build_payload(config(), document())

      assert payload["DateTime"] == "2026-08-31 09:15:00"
    end

    test "totals the quantity across lines" do
      lines = [
        %{quantity: Decimal.new("2"), name: "a"},
        %{quantity: Decimal.new("3.5"), name: "b"}
      ]

      payload = FBR.build_payload(config(), document(%{lines: lines}))

      assert payload["TotalQuantity"] == 5.5
    end

    test "a refund is marked as a note against an earlier invoice" do
      payload = FBR.build_payload(config(), document(%{kind: "refund"}))

      assert payload["InvoiceType"] == 3
    end

    test "carries the buyer when there is one" do
      buyer = %{name: "Ayesha", tax_number: "999", national_id: "35202-1", phone: "0300"}
      payload = FBR.build_payload(config(), document(%{buyer: buyer}))

      assert payload["BuyerName"] == "Ayesha"
      assert payload["BuyerNTN"] == "999"
      assert payload["BuyerCNIC"] == "35202-1"
    end

    test "a walk-in customer leaves the buyer fields empty rather than absent" do
      payload = FBR.build_payload(config(), document())

      assert Map.has_key?(payload, "BuyerName")
      assert payload["BuyerName"] == nil
    end
  end

  describe "FBR responses" do
    test "code 100 with a number is an acceptance" do
      FiscalStub.respond({:ok, %{"Code" => "100", "InvoiceNumber" => "0123456", "Response" => "OK"}})

      assert {:accepted, result} = FBR.submit(config(), document())
      assert result.fiscal_number == "0123456"
      assert result.qr_payload == "0123456"
    end

    test "any other code is a rejection, however healthy the HTTP status" do
      # The failure this guards against: a 200 carrying a refusal, read as an
      # acceptance, stamping a receipt with a number that does not exist.
      FiscalStub.respond({:ok, %{"Code" => "102", "Response" => "Invalid NTN"}})

      assert {:rejected, rejection} = FBR.submit(config(), document())
      assert rejection.code == "102"
      assert rejection.message == "Invalid NTN"
    end

    test "a success carrying no invoice number is not an acceptance" do
      FiscalStub.respond({:ok, %{"Code" => "100"}})

      assert {:rejected, _rejection} = FBR.submit(config(), document())
    end

    test "an unreachable authority is a failure, not a rejection" do
      # The distinction the whole retry design rests on: this one will very
      # likely work next time, and a rejection never will.
      FiscalStub.respond({:error, :timeout})

      assert {:failed, :timeout} = FBR.submit(config(), document())
    end

    test "a list of errors is flattened into something a text column can hold" do
      FiscalStub.respond({:ok, %{"Code" => "102", "Errors" => ["Bad NTN", "Bad POS"]}})

      assert {:rejected, rejection} = FBR.submit(config(), document())
      assert is_binary(rejection.message)
      assert rejection.message =~ "Bad NTN"
      assert rejection.message =~ "Bad POS"
    end

    test "sends the bearer token and honours a configured endpoint" do
      FiscalStub.respond({:ok, %{"Code" => "100", "InvoiceNumber" => "1"}})

      FBR.submit(config(%{endpoint_url: "https://example.test/file"}), document())

      request = FiscalStub.last_request()
      assert request.url == "https://example.test/file"
      assert {"authorization", "Bearer secret-token"} in request.headers
    end

    test "test and live are different endpoints" do
      FiscalStub.respond({:ok, %{"Code" => "100", "InvoiceNumber" => "1"}})

      FBR.submit(config(%{mode: "test"}), document())
      sandbox = FiscalStub.last_request().url

      FBR.submit(config(%{mode: "live"}), document())
      live = FiscalStub.last_request().url

      refute sandbox == live
    end
  end

  # ===========================================================================
  # Generic
  # ===========================================================================

  describe "generic adapter" do
    test "serialises money as strings, the way the rest of the platform does" do
      payload = Generic.build_payload(generic(), document())

      assert payload["totals"]["total"] == "1170.00"
      assert [line] = payload["lines"]
      assert line["net_total"] == "1000.00"
    end

    test "reads a fiscal number from whichever key the scheme uses" do
      FiscalStub.respond({:ok, %{"uuid" => "abc-123", "qr" => "QRDATA"}})

      assert {:accepted, result} = Generic.submit(generic(), document())
      assert result.fiscal_number == "abc-123"
      assert result.qr_payload == "QRDATA"
    end

    test "reads it out of a nested envelope too" do
      FiscalStub.respond({:ok, %{"data" => %{"invoice_number" => "E-77"}}})

      assert {:accepted, result} = Generic.submit(generic(), document())
      assert result.fiscal_number == "E-77"
    end

    test "an explicit rejection wins over a number in the body" do
      FiscalStub.respond(
        {:ok, %{"status" => "rejected", "uuid" => "ignored", "message" => "Bad tax number"}}
      )

      assert {:rejected, rejection} = Generic.submit(generic(), document())
      assert rejection.message == "Bad tax number"
    end

    test "cleared with nothing to print is treated as a rejection" do
      FiscalStub.respond({:ok, %{"status" => "cleared"}})

      assert {:rejected, rejection} = Generic.submit(generic(), document())
      assert rejection.code == "no_fiscal_number"
    end

    test "no endpoint is a rejection, because retrying discovers no address" do
      assert {:rejected, rejection} = Generic.submit(generic(%{endpoint_url: nil}), document())
      assert rejection.code == "no_endpoint"
    end

    test "an unreachable endpoint is a failure" do
      FiscalStub.respond({:error, :econnrefused})

      assert {:failed, :econnrefused} = Generic.submit(generic(), document())
    end
  end

  # ===========================================================================
  # Config
  # ===========================================================================

  describe "configuration predicates" do
    test "an inactive or deleted config does not file" do
      refute Config.reporting?(nil)
      refute Config.reporting?(config(%{is_active: false}))
      refute Config.reporting?(config(%{deleted_at: DateTime.utc_now()}))
      refute Config.reporting?(%Config{adapter: "none", is_active: true})
      assert Config.reporting?(config())
    end

    test "blocking is off unless it was asked for" do
      refute Config.blocking?(config())
      assert Config.blocking?(config(%{block_on_failure: true}))
    end

    test "a config that does not file cannot block selling" do
      # Otherwise switching reporting off would leave the till refusing to sell
      # for a reason nobody could find.
      refute Config.blocking?(config(%{is_active: false, block_on_failure: true}))
    end

    test "switching on without registration details is refused" do
      changeset =
        Config.changeset(%Config{}, %{"adapter" => "fbr", "is_active" => true})

      refute changeset.valid?
      assert %{taxpayer_number: [_message]} = errors_on(changeset)
    end

    test "an inactive config may be saved half-finished" do
      changeset = Config.changeset(%Config{}, %{"adapter" => "fbr"})

      assert changeset.valid?
    end
  end
end
