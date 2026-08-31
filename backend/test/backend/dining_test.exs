defmodule Kaarobar.DiningTest do
  @moduledoc """
  The restaurant flow end to end: seat a party, order, fire a course, cook it,
  bump it, bill the table.
  """

  use Kaarobar.DataCase, async: true

  alias Kaarobar.Dining
  alias Kaarobar.Kitchen
  alias Kaarobar.Sales

  setup do
    %{scope: scope} = owner_scope(business_type: "restaurant")

    grill = station(scope, "Grill")
    bar = station(scope, "Bar")

    burger = dish(scope, "Burger", "450.00", grill)
    cola = dish(scope, "Cola", "120.00", bar)

    table = table_fixture(scope, "4")

    %{scope: scope, grill: grill, bar: bar, burger: burger, cola: cola, table: table}
  end

  defp station(scope, name) do
    {:ok, station} = Kitchen.create_station(scope, %{"name" => name})
    station
  end

  defp dish(scope, name, price, station) do
    product =
      product_fixture(scope, %{
        "name" => name,
        "price" => price,
        "kind" => "item",
        "tracks_stock" => false
      })

    {:ok, _updated} =
      Kaarobar.Catalog.update_product(scope, product, %{"kitchen_station_id" => station.id})

    [variant] = Kaarobar.Catalog.list_variants(scope, product)
    variant
  end

  defp table_fixture(scope, name) do
    {:ok, table} = Dining.create_table(scope, %{"name" => name, "seats" => 4})
    table
  end

  describe "seating a party" do
    test "opens the bill with them", ctx do
      {:ok, session} = Dining.seat(ctx.scope, ctx.table, %{"covers" => 3})

      assert session.status == "open"
      assert session.covers == 3
      # The bill is an ordinary ticket, so everything a ticket can do works.
      assert session.order_id
      assert session.order.service_mode == "dine_in"
    end

    test "a second party cannot be seated at the same table", ctx do
      {:ok, _first} = Dining.seat(ctx.scope, ctx.table, %{"covers" => 2})

      assert {:error, changeset} = Dining.seat(ctx.scope, ctx.table, %{"covers" => 2})
      assert "already has a party seated" in errors_on(changeset).dining_table_id
    end

    test "the floor plan shows the table as occupied", ctx do
      {:ok, _session} = Dining.seat(ctx.scope, ctx.table, %{"covers" => 2})

      assert [entry] = Dining.floor_plan(ctx.scope)
      assert entry.occupied
      assert entry.session.covers == 2
      assert entry.minutes_seated == 0
    end

    test "a table nobody is at reads as free", ctx do
      assert [entry] = Dining.floor_plan(ctx.scope)
      refute entry.occupied
      assert is_nil(entry.session)
    end
  end

  describe "firing a course" do
    setup ctx do
      {:ok, session} = Dining.seat(ctx.scope, ctx.table, %{"covers" => 2})
      {:ok, order} = Sales.fetch_order(ctx.scope, session.order_id)

      {:ok, order} =
        Sales.add_order_items(ctx.scope, order, [
          %{"variant_id" => ctx.burger.id, "quantity" => "2"},
          %{"variant_id" => ctx.cola.id, "quantity" => "2"}
        ])

      Map.merge(ctx, %{session: session, order: order})
    end

    test "splits the order by station, so each screen sees only its own work", ctx do
      {:ok, tickets} = Kitchen.fire(ctx.scope, ctx.order)

      assert length(tickets) == 2
      stations = tickets |> Enum.map(& &1.kitchen_station_id) |> Enum.sort()
      assert stations == Enum.sort([ctx.grill.id, ctx.bar.id])

      grill_ticket = Enum.find(tickets, &(&1.kitchen_station_id == ctx.grill.id))
      {:ok, loaded} = Kitchen.fetch_ticket(ctx.scope, grill_ticket.id)

      assert [item] = loaded.items
      assert item.name_snapshot == "Burger"
    end

    test "marks the order lines fired, so firing twice is harmless", ctx do
      {:ok, first} = Kitchen.fire(ctx.scope, ctx.order)
      assert length(first) == 2

      # At a busy pass somebody will hit it again.
      {:ok, second} = Kitchen.fire(ctx.scope, ctx.order)
      assert second == []
    end

    test "an order with no unfired lines of that course fires nothing", ctx do
      assert {:ok, []} = Kitchen.fire(ctx.scope, ctx.order, course: 2)
    end

    test "a kitchen with no stations refuses rather than losing the food", _ctx do
      %{scope: bare} = owner_scope(business_type: "restaurant")
      variant = variant_fixture(bare, %{"name" => "Soup", "price" => "200.00"})
      {:ok, order} = Sales.create_order(bare, %{})

      {:ok, order} =
        Sales.add_order_items(bare, order, [%{"variant_id" => variant.id, "quantity" => "1"}])

      assert {:error, :no_kitchen_stations} = Kitchen.fire(bare, order)
    end
  end

  describe "the kitchen display" do
    setup ctx do
      {:ok, session} = Dining.seat(ctx.scope, ctx.table, %{"covers" => 2})
      {:ok, order} = Sales.fetch_order(ctx.scope, session.order_id)

      {:ok, order} =
        Sales.add_order_items(ctx.scope, order, [
          %{"variant_id" => ctx.burger.id, "quantity" => "1"}
        ])

      {:ok, [ticket]} = Kitchen.fire(ctx.scope, order)
      Map.merge(ctx, %{session: session, order: order, ticket: ticket})
    end

    test "shows live tickets with the clock already computed", ctx do
      assert [entry] = Kitchen.board(ctx.scope)
      assert entry.ticket.id == ctx.ticket.id
      assert entry.elapsed_minutes == 0
      assert entry.minutes_late == 0
    end

    test "filters to one station", ctx do
      assert [_grill] = Kitchen.board(ctx.scope, station_id: ctx.grill.id)
      assert [] == Kitchen.board(ctx.scope, station_id: ctx.bar.id)
    end

    test "bumping clears it from the board and marks the food served", ctx do
      {:ok, _bumped} = Kitchen.bump(ctx.scope, ctx.ticket)

      assert Kitchen.board(ctx.scope) == []

      {:ok, order} = Sales.fetch_order(ctx.scope, ctx.order.id)
      assert Enum.all?(order.items, &(&1.kitchen_status == "served"))
    end

    test "recalling puts it back, because somebody always bumps the wrong one", ctx do
      {:ok, bumped} = Kitchen.bump(ctx.scope, ctx.ticket)
      {:ok, recalled} = Kitchen.recall(ctx.scope, bumped)

      assert recalled.status == "fired"
      assert recalled.recalled_at
      assert [_back] = Kitchen.board(ctx.scope)
    end

    test "marking ready leaves it on the board but tells the floor", ctx do
      {:ok, ready} = Kitchen.mark_ready(ctx.scope, ctx.ticket)
      assert ready.status == "ready"
      # Still the kitchen's problem until it is bumped.
      assert [_still_up] = Kitchen.board(ctx.scope)

      {:ok, order} = Sales.fetch_order(ctx.scope, ctx.order.id)
      assert Enum.all?(order.items, &(&1.kitchen_status == "ready"))
    end
  end

  describe "moving parties" do
    setup ctx do
      {:ok, session} = Dining.seat(ctx.scope, ctx.table, %{"covers" => 2})
      other = table_fixture(ctx.scope, "5")
      Map.merge(ctx, %{session: session, other: other})
    end

    test "transferring keeps the same bill", ctx do
      {:ok, moved} = Dining.transfer(ctx.scope, ctx.session, ctx.other)

      assert moved.dining_table_id == ctx.other.id
      assert moved.order_id == ctx.session.order_id
    end

    test "refuses to move a party onto an occupied table", ctx do
      {:ok, _sitting} = Dining.seat(ctx.scope, ctx.other, %{"covers" => 4})

      assert {:error, :table_occupied} =
               Dining.transfer(ctx.scope, ctx.session, ctx.other)
    end

    test "merging moves the unbilled lines and keeps the absorbed sitting", ctx do
      {:ok, second} = Dining.seat(ctx.scope, ctx.other, %{"covers" => 2})
      {:ok, second_order} = Sales.fetch_order(ctx.scope, second.order_id)

      {:ok, _with_items} =
        Sales.add_order_items(ctx.scope, second_order, [
          %{"variant_id" => ctx.burger.id, "quantity" => "1"}
        ])

      {:ok, survivor} = Dining.merge(ctx.scope, second, ctx.session)

      assert survivor.id == ctx.session.id

      # The absorbed sitting is kept, so those covers stay counted where they sat.
      {:ok, absorbed} = Dining.fetch_session(ctx.scope, second.id)
      assert absorbed.status == "merged"
      assert absorbed.merged_into_id == ctx.session.id

      # And the food came with it.
      {:ok, order} = Sales.fetch_order(ctx.scope, ctx.session.order_id)
      assert length(order.items) == 1
    end

    test "a sitting cannot be merged into itself", ctx do
      assert {:error, :cannot_merge_into_itself} =
               Dining.merge(ctx.scope, ctx.session, ctx.session)
    end
  end

  describe "clearing the table" do
    test "refuses while the bill still has unpaid food on it", ctx do
      {:ok, session} = Dining.seat(ctx.scope, ctx.table, %{"covers" => 2})
      {:ok, order} = Sales.fetch_order(ctx.scope, session.order_id)

      {:ok, _with_items} =
        Sales.add_order_items(ctx.scope, order, [
          %{"variant_id" => ctx.burger.id, "quantity" => "1"}
        ])

      {:ok, session} = Dining.fetch_session(ctx.scope, session.id)
      assert {:error, :bill_outstanding} = Dining.close_session(ctx.scope, session)
    end

    test "an empty table clears, and the plan frees up", ctx do
      {:ok, session} = Dining.seat(ctx.scope, ctx.table, %{"covers" => 2})
      {:ok, closed} = Dining.close_session(ctx.scope, session)

      assert closed.status == "closed"
      assert closed.closed_at

      assert [entry] = Dining.floor_plan(ctx.scope)
      refute entry.occupied
    end

    test "a table with a party at it cannot be deleted", ctx do
      {:ok, _session} = Dining.seat(ctx.scope, ctx.table, %{"covers" => 2})

      assert {:error, :occupied} = Dining.delete_table(ctx.scope, ctx.table)
    end
  end
end
