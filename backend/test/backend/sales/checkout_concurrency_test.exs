defmodule Kaarobar.Sales.CheckoutConcurrencyTest do
  @moduledoc """
  The phase gate's sharpest edge: two cashiers, one unit left, one sale.

  ## Why this test cannot use the sandbox

  Every other test runs inside a sandbox transaction, which is what makes them
  fast and independent. But a sandbox gives the whole test one connection, and
  two checkouts sharing one connection are not concurrent — they are two
  statements in a queue, and the row lock they are meant to be contending for
  is never contended.

  So this one runs unboxed: two real connections, two real transactions,
  contending for the same `stock_items` row. It commits for real and cleans up
  after itself, in foreign-key order, at the end.

  It is tagged `:concurrency` so it can be excluded from a fast loop. It should
  not be excluded from CI: this is the behaviour that separates a POS from a
  spreadsheet, and it is not provable any other way.
  """

  use ExUnit.Case, async: false

  import Kaarobar.Factory

  alias Ecto.Adapters.SQL
  alias Kaarobar.Inventory
  alias Kaarobar.Repo
  alias Kaarobar.Sales.Checkout

  @moduletag :concurrency

  # Deleted newest-first so no foreign key is ever left dangling. `restrict` on
  # most of these is deliberate elsewhere in the schema; here it dictates the
  # order.
  @teardown_order ~w(
    payment_refunds payments sale_item_taxes sale_item_modifiers sale_items
    sale_return_items sale_returns refund_request_items refund_requests sales
    order_item_modifiers order_items orders
    cash_movements shifts registers
    customer_ledger_entries customer_payments customers
    cost_layers stock_moves stock_items
    document_sequences audit_logs
    product_barcodes variant_option_values product_variants products
    membership_roles membership_branches memberships
    branches businesses user_tokens organizations
  )

  setup do
    SQL.Sandbox.mode(Repo, :auto)
    on_exit(fn -> SQL.Sandbox.mode(Repo, :manual) end)
    :ok
  end

  test "two tills cannot both sell the last unit" do
    %{scope: scope, organization: organization, branch: branch, user: user} = owner_scope()

    on_exit(fn -> purge(organization.id, user.id) end)

    variant = variant_fixture(scope, %{"name" => "Last one", "price" => "100.00"})
    stock_fixture(scope, variant, "1", unit_cost: "40.00")

    %{register: first_till} = open_till(scope)
    %{register: second_till} = open_till(scope, %{register: %{"name" => "Till B"}})

    basket = fn register ->
      %{
        "register_id" => register.id,
        "lines" => [%{"variant_id" => variant.id, "quantity" => "1"}],
        "payments" => [%{"method" => "cash", "amount" => "100.00"}]
      }
    end

    results =
      [first_till, second_till]
      |> Enum.map(fn register ->
        Task.async(fn -> Checkout.run(scope, basket.(register)) end)
      end)
      |> Task.await_many(30_000)

    sold = Enum.count(results, &match?({:ok, _sale}, &1))
    refused = Enum.count(results, &match?({:error, {:insufficient_stock, _variant}}, &1))

    assert sold == 1, "expected exactly one sale, got #{sold}: #{inspect(results)}"

    assert refused == 1,
           "expected the loser to be told the stock ran out, got: #{inspect(results)}"

    {:ok, item} = Inventory.fetch_stock_item(scope, variant.id, branch.id)

    assert Decimal.equal?(item.on_hand, Decimal.new(0)),
           "stock should be exactly zero, is #{Decimal.to_string(item.on_hand, :normal)}"

    # And the ledger agrees: one opening move in, one sale move out.
    moves = scope |> Inventory.move_query(%{"variant_id" => variant.id}) |> Repo.all()
    assert length(moves) == 2
  end

  defp purge(organization_id, user_id) do
    Enum.each(@teardown_order, fn table ->
      if has_column?(table, "organization_id") do
        SQL.query!(Repo, "DELETE FROM #{table} WHERE organization_id = $1", [
          uuid(organization_id)
        ])
      else
        SQL.query!(Repo, "DELETE FROM #{table}", [])
      end
    end)

    SQL.query!(Repo, "DELETE FROM users WHERE id = $1", [uuid(user_id)])
  end

  # Not every table carries the organization; the join tables hang off rows
  # already deleted above, so clearing them wholesale is safe here and would
  # not be anywhere else.
  defp has_column?(table, column) do
    %{rows: rows} =
      SQL.query!(
        Repo,
        "SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2",
        [table, column]
      )

    rows != []
  end

  defp uuid(value) do
    {:ok, raw} = Ecto.UUID.dump(value)
    raw
  end
end
