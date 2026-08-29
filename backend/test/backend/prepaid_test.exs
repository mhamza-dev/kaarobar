defmodule Kaarobar.PrepaidTest do
  @moduledoc """
  Store credit and gift cards: money the shop already took and owes back.
  """

  use Kaarobar.DataCase, async: true

  import Kaarobar.Factory

  alias Kaarobar.Money
  alias Kaarobar.Prepaid
  alias Kaarobar.Prepaid.GiftCard

  setup do
    %{scope: scope} = owner_scope()
    customer = customer_fixture(scope, %{"name" => "Returner"})
    %{scope: scope, customer: customer}
  end

  describe "store credit" do
    test "is issued with a movement behind it, not just a balance", ctx do
      {:ok, credit} =
        Prepaid.issue_store_credit(ctx.scope, ctx.customer, %{
          amount: "1500.00",
          reason: "Return of INV-0001"
        })

      assert Decimal.equal?(credit.issued_amount, Decimal.new("1500.00"))
      assert Decimal.equal?(credit.balance, Decimal.new("1500.00"))

      assert [entry] = Prepaid.store_credit_history(ctx.scope, credit)
      assert entry.kind == "issue"
      assert Decimal.equal?(entry.balance_after, Decimal.new("1500.00"))
    end

    test "spends down and refuses to overdraw", ctx do
      {:ok, credit} = Prepaid.issue_store_credit(ctx.scope, ctx.customer, %{amount: "1000.00"})

      {:ok, _spent} = Prepaid.redeem_store_credit(ctx.scope, credit, "400.00")

      assert Decimal.equal?(
               Prepaid.store_credit_balance(ctx.scope, ctx.customer),
               Decimal.new("600.00")
             )

      {:ok, reloaded} = fetch_credit(ctx.scope, credit)

      assert {:error, :insufficient_balance} =
               Prepaid.redeem_store_credit(ctx.scope, reloaded, "700.00")
    end

    test "an expired credit cannot be spent", ctx do
      {:ok, credit} =
        Prepaid.issue_store_credit(ctx.scope, ctx.customer, %{
          amount: "1000.00",
          expires_on: Date.add(Date.utc_today(), -1)
        })

      assert {:error, :store_credit_expired} =
               Prepaid.redeem_store_credit(ctx.scope, credit, "100.00")

      # And it does not count towards what they can spend.
      assert Money.zero?(Prepaid.store_credit_balance(ctx.scope, ctx.customer))
    end

    test "the balance is the sum of what is still spendable", ctx do
      {:ok, _first} = Prepaid.issue_store_credit(ctx.scope, ctx.customer, %{amount: "500.00"})
      {:ok, _second} = Prepaid.issue_store_credit(ctx.scope, ctx.customer, %{amount: "250.00"})

      assert Decimal.equal?(
               Prepaid.store_credit_balance(ctx.scope, ctx.customer),
               Decimal.new("750.00")
             )
    end
  end

  describe "gift cards" do
    test "hand back the code once, and never store it", ctx do
      {:ok, card} = Prepaid.issue_gift_card(ctx.scope, %{amount: "5000.00"})

      assert is_binary(card.code)
      assert String.length(card.code) == 16
      # What is kept is the hash and the tail, not the code.
      assert card.code_hash == GiftCard.hash_code(card.code)
      assert card.code_last_four == String.slice(card.code, -4, 4)

      # Reading it back gives no way to recover the code.
      {:ok, found} = Prepaid.find_gift_card(ctx.scope, card.code)
      assert found.id == card.id
      assert is_nil(found.code)
    end

    test "the code is found however it was typed", ctx do
      {:ok, card} = Prepaid.issue_gift_card(ctx.scope, %{amount: "1000.00"})
      spaced = card.code |> String.downcase() |> String.replace(~r/(.{4})/, "\\1-")

      assert {:ok, found} = Prepaid.find_gift_card(ctx.scope, spaced)
      assert found.id == card.id
    end

    test "start inactive and cannot be spent until the sale is paid for", ctx do
      {:ok, card} = Prepaid.issue_gift_card(ctx.scope, %{amount: "1000.00"})
      assert card.status == "inactive"

      assert {:error, :gift_card_inactive} =
               Prepaid.redeem_gift_card(ctx.scope, card, "100.00")

      {:ok, live} = Prepaid.activate_gift_card(ctx.scope, card)
      assert live.status == "active"
      assert {:ok, _spent} = Prepaid.redeem_gift_card(ctx.scope, live, "100.00")
    end

    test "the issue entry moves the balance from nothing to the face value", ctx do
      {:ok, card} = Prepaid.issue_gift_card(ctx.scope, %{amount: "2000.00"})

      assert [entry] = Prepaid.gift_card_history(ctx.scope, card)
      assert entry.kind == "issue"
      assert Decimal.equal?(entry.amount, Decimal.new("2000.00"))
      assert Decimal.equal?(entry.balance_after, Decimal.new("2000.00"))

      {:ok, reloaded} = Prepaid.find_gift_card(ctx.scope, card.code)
      assert Decimal.equal?(reloaded.balance, Decimal.new("2000.00"))
    end

    test "go depleted when spent out, and refuse to overdraw", ctx do
      {:ok, card} = Prepaid.issue_gift_card(ctx.scope, %{amount: "500.00"})
      {:ok, live} = Prepaid.activate_gift_card(ctx.scope, card)

      {:ok, _spent} = Prepaid.redeem_gift_card(ctx.scope, live, "500.00")

      {:ok, spent_out} = Prepaid.find_gift_card(ctx.scope, card.code)
      assert spent_out.status == "depleted"
      assert Money.zero?(spent_out.balance)

      assert {:error, :insufficient_balance} =
               Prepaid.redeem_gift_card(ctx.scope, spent_out, "1.00")
    end

    test "can be topped up", ctx do
      {:ok, card} = Prepaid.issue_gift_card(ctx.scope, %{amount: "500.00"})
      {:ok, live} = Prepaid.activate_gift_card(ctx.scope, card)

      {:ok, entry} = Prepaid.top_up_gift_card(ctx.scope, live, "300.00")
      assert Decimal.equal?(entry.balance_after, Decimal.new("800.00"))
    end

    test "generated codes avoid the characters people confuse", ctx do
      _ = ctx
      codes = Enum.map(1..40, fn _index -> Prepaid.generate_code() end)

      refute Enum.any?(codes, &String.contains?(&1, ["O", "0", "I", "1", "S", "5", "B", "8"]))
      # And they do not collide.
      assert codes |> Enum.uniq() |> length() == 40
    end

    test "one shop cannot read another's cards", ctx do
      {:ok, card} = Prepaid.issue_gift_card(ctx.scope, %{amount: "1000.00"})

      %{scope: other_shop} = owner_scope()
      assert {:error, :not_found} = Prepaid.find_gift_card(other_shop, card.code)
    end
  end

  # Redeeming locks and re-reads the row, so the caller's copy goes stale as
  # soon as it is spent against.
  defp fetch_credit(_scope, credit) do
    case Kaarobar.Repo.get(Kaarobar.Prepaid.StoreCredit, credit.id) do
      nil -> {:error, :not_found}
      found -> {:ok, found}
    end
  end
end
