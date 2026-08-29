defmodule Kaarobar.LoyaltyTest do
  @moduledoc """
  Points are a liability payable in stock, so every test here is really about
  the shop not giving away more than it meant to.
  """

  use Kaarobar.DataCase, async: true

  import Kaarobar.Factory

  alias Kaarobar.Loyalty
  alias Kaarobar.Loyalty.Program
  alias Kaarobar.Money

  setup do
    %{scope: scope} = owner_scope()
    customer = customer_fixture(scope, %{"name" => "Regular"})

    {:ok, program} =
      Loyalty.create_program(scope, %{
        "name" => "Shop points",
        "earn_rate" => "1",
        "redeem_rate" => "0.01"
      })

    %{scope: scope, customer: customer, program: program}
  end

  describe "earning" do
    test "awards points on the net, and enrols on first use", ctx do
      assert Loyalty.account_for(ctx.scope, ctx.customer) == nil

      {:ok, transaction} =
        Loyalty.earn(ctx.scope, ctx.customer, %{subtotal: Decimal.new("450.00")})

      assert transaction.points == 450
      assert transaction.balance_after == 450

      account = Loyalty.account_for(ctx.scope, ctx.customer)
      assert account.points_balance == 450
      assert account.lifetime_earned == 450
    end

    test "rounds down, so the scheme never pays out more than it charges for", ctx do
      {:ok, transaction} =
        Loyalty.earn(ctx.scope, ctx.customer, %{subtotal: Decimal.new("99.90")})

      assert transaction.points == 99
    end

    test "excludes tax unless the programme says otherwise", ctx do
      {:ok, transaction} =
        Loyalty.earn(ctx.scope, ctx.customer, %{
          subtotal: Decimal.new("100.00"),
          total: Decimal.new("117.00")
        })

      assert transaction.points == 100

      {:ok, _updated} = Loyalty.update_program(ctx.scope, ctx.program, %{"earn_on_tax" => true})

      {:ok, with_tax} =
        Loyalty.earn(ctx.scope, ctx.customer, %{
          subtotal: Decimal.new("100.00"),
          total: Decimal.new("117.00")
        })

      assert with_tax.points == 117
    end

    test "can be told not to pay points on a discounted line", ctx do
      {:ok, _updated} =
        Loyalty.update_program(ctx.scope, ctx.program, %{"earn_on_discounted" => false})

      {:ok, transaction} =
        Loyalty.earn(ctx.scope, ctx.customer, %{
          subtotal: Decimal.new("500.00"),
          discount_total: Decimal.new("200.00")
        })

      assert transaction.points == 300
    end

    test "a shop with no programme earns nothing and does not fail", ctx do
      {:ok, plain} = owner_scope() |> Map.fetch(:scope)
      other = customer_fixture(plain, %{"name" => "No Scheme"})

      assert {:ok, :no_program} = Loyalty.earn(plain, other, %{subtotal: Decimal.new("500.00")})
    end
  end

  describe "redeeming" do
    setup ctx do
      {:ok, _earned} =
        Loyalty.earn(ctx.scope, ctx.customer, %{subtotal: Decimal.new("10000.00")})

      ctx
    end

    test "returns what the points were worth and takes them off the balance", ctx do
      {:ok, %{transaction: transaction, value: value}} =
        Loyalty.redeem(ctx.scope, ctx.customer, 5000, %{bill_total: Decimal.new("1000.00")})

      assert Decimal.equal?(value, Decimal.new("50.00"))
      assert transaction.points == -5000

      account = Loyalty.account_for(ctx.scope, ctx.customer)
      assert account.points_balance == 5000
      assert account.lifetime_redeemed == 5000
      # Redeeming does not undo what was earned — tiers are earned, not held.
      assert account.lifetime_earned == 10_000
    end

    test "refuses more points than the customer holds", ctx do
      assert {:error, :insufficient_points} =
               Loyalty.redeem(ctx.scope, ctx.customer, 20_000, %{
                 bill_total: Decimal.new("5000.00")
               })
    end

    test "refuses to pay for more of the bill than the programme allows", ctx do
      {:ok, _updated} =
        Loyalty.update_program(ctx.scope, ctx.program, %{"max_redeem_percent" => "0.5"})

      # A 100 bill caps redemption at 50, which is 5,000 points.
      assert {:error, :exceeds_redemption_cap} =
               Loyalty.redeem(ctx.scope, ctx.customer, 6000, %{bill_total: Decimal.new("100.00")})

      assert {:ok, _within_cap} =
               Loyalty.redeem(ctx.scope, ctx.customer, 5000, %{bill_total: Decimal.new("100.00")})
    end

    test "respects the minimum before anything may be redeemed", ctx do
      {:ok, _updated} =
        Loyalty.update_program(ctx.scope, ctx.program, %{"min_points_to_redeem" => 50_000})

      assert {:error, :insufficient_points} =
               Loyalty.redeem(ctx.scope, ctx.customer, 100, %{bill_total: Decimal.new("500.00")})
    end

    test "a balance can never go negative", ctx do
      assert {:error, :insufficient_points} = Loyalty.redeem(ctx.scope, ctx.customer, 10_001, %{})

      account = Loyalty.account_for(ctx.scope, ctx.customer)
      assert account.points_balance == 10_000
    end
  end

  describe "the ledger" do
    test "every movement snapshots the balance that followed it", ctx do
      {:ok, _first} = Loyalty.earn(ctx.scope, ctx.customer, %{subtotal: Decimal.new("300.00")})
      {:ok, _second} = Loyalty.earn(ctx.scope, ctx.customer, %{subtotal: Decimal.new("200.00")})
      {:ok, _spent} = Loyalty.redeem(ctx.scope, ctx.customer, 100, %{})

      account = Loyalty.account_for(ctx.scope, ctx.customer)
      history = Loyalty.list_transactions(ctx.scope, account)

      assert Enum.map(history, & &1.balance_after) == [400, 500, 300]
      # The last snapshot and the projection agree — the whole point of keeping
      # both.
      assert account.points_balance == 400
    end

    test "an adjustment needs a reason", ctx do
      assert {:error, :reason_required} = Loyalty.adjust(ctx.scope, ctx.customer, 100, "  ")
      assert {:ok, entry} = Loyalty.adjust(ctx.scope, ctx.customer, 100, "Goodwill after mis-scan")
      assert entry.kind == "adjustment"
      assert entry.note == "Goodwill after mis-scan"
    end

    test "a reversal is distinguishable from an earning", ctx do
      {:ok, entry} = Loyalty.reverse(ctx.scope, ctx.customer, 250, %{note: "Return of INV-1"})
      assert entry.kind == "reversal"
      assert entry.points == 250
    end
  end

  describe "expiry" do
    test "takes back points that have passed their date", ctx do
      {:ok, _updated} =
        Loyalty.update_program(ctx.scope, ctx.program, %{"points_expire_after_days" => 30})

      {:ok, earned} = Loyalty.earn(ctx.scope, ctx.customer, %{subtotal: Decimal.new("500.00")})
      assert earned.expires_on == Date.add(Date.utc_today(), 30)

      # Nothing lapses today.
      assert {:ok, 0} = Loyalty.expire_due(ctx.scope)

      # A month on, it does.
      assert {:ok, 1} = Loyalty.expire_due(ctx.scope, Date.add(Date.utc_today(), 31))

      account = Loyalty.account_for(ctx.scope, ctx.customer)
      assert account.points_balance == 0
    end

    test "cannot expire points the customer has already spent", ctx do
      {:ok, _updated} =
        Loyalty.update_program(ctx.scope, ctx.program, %{"points_expire_after_days" => 30})

      {:ok, _earned} = Loyalty.earn(ctx.scope, ctx.customer, %{subtotal: Decimal.new("500.00")})
      {:ok, _spent} = Loyalty.redeem(ctx.scope, ctx.customer, 400, %{})

      {:ok, _count} = Loyalty.expire_due(ctx.scope, Date.add(Date.utc_today(), 31))

      # 500 earned, 400 spent, so only 100 was left to lapse — not 500.
      account = Loyalty.account_for(ctx.scope, ctx.customer)
      assert account.points_balance == 0
    end

    test "points with no expiry are never swept", ctx do
      {:ok, _earned} = Loyalty.earn(ctx.scope, ctx.customer, %{subtotal: Decimal.new("500.00")})

      assert {:ok, 0} = Loyalty.expire_due(ctx.scope, Date.add(Date.utc_today(), 3650))

      account = Loyalty.account_for(ctx.scope, ctx.customer)
      assert account.points_balance == 500
    end
  end

  describe "the programme" do
    test "only one may run at a time", ctx do
      assert {:error, changeset} =
               Loyalty.create_program(ctx.scope, %{"name" => "Second scheme"})

      assert "another programme is already running" in errors_on(changeset).is_active
    end

    test "values points at the redeem rate, not the earn rate", ctx do
      assert Decimal.equal?(Program.value_of(ctx.program, 1000), Decimal.new("10.00"))
      assert Money.zero?(Program.value_of(ctx.program, 0))
    end
  end
end
