defmodule Kaarobar.ServiceDeskTest do
  @moduledoc """
  The laundry flow: take work in, tag it, do it, rack it, hand it back — and
  the refusals that stop a shop losing somebody's coat or their money.
  """

  use Kaarobar.DataCase, async: true

  alias Kaarobar.Money
  alias Kaarobar.ServiceDesk
  alias Kaarobar.ServiceDesk.Job

  setup do
    %{scope: scope} = owner_scope(business_type: "laundry")
    %{scope: scope}
  end

  defp intake(scope, attrs \\ %{}) do
    defaults = %{
      "walk_in_name" => "Imran",
      "walk_in_phone" => "03001234567",
      "promised_on" => Date.add(Date.utc_today(), 2),
      "items" => [
        %{
          "description" => "Blue cotton shirt",
          "quantity" => "2",
          "unit_price" => "150.00",
          "tag_code" => "t-1001",
          "condition_notes" => "Faint mark on left cuff"
        },
        %{"description" => "Grey coat", "quantity" => "1", "unit_price" => "500.00", "tag_code" => "T-1002"}
      ]
    }

    {:ok, job} = ServiceDesk.take_in(scope, Map.merge(defaults, attrs))
    job
  end

  describe "taking work in" do
    test "records each piece separately, with its tag and its condition", ctx do
      job = intake(ctx.scope)

      assert job.status == "intake"
      assert length(job.items) == 2

      shirt = Enum.find(job.items, &(&1.description == "Blue cotton shirt"))
      # Tags are normalised: "t-1001" and "T-1001" are one tag, not two.
      assert shirt.tag_code == "T1001"
      assert shirt.condition_notes == "Faint mark on left cuff"
    end

    test "totals the quote from the items so nobody types it twice", ctx do
      job = intake(ctx.scope)
      # Two shirts at 150 plus a coat at 500.
      assert Decimal.equal?(job.quoted_total, Decimal.new("800.00"))
      assert Decimal.equal?(Job.balance_due(job), Decimal.new("800.00"))
    end

    test "writes an intake event the customer could be shown", ctx do
      job = intake(ctx.scope)

      assert [event] = ServiceDesk.history(ctx.scope, job)
      assert event.kind == "received"
      assert event.summary =~ "2 item(s) received"
    end

    test "a job with no items is refused", ctx do
      assert {:error, :items_required} =
               ServiceDesk.take_in(ctx.scope, %{"walk_in_name" => "Imran", "items" => []})
    end

    test "the same tag cannot be on two items", ctx do
      _first = intake(ctx.scope)

      assert {:error, changeset} =
               ServiceDesk.take_in(ctx.scope, %{
                 "walk_in_name" => "Someone",
                 "items" => [%{"description" => "Shirt", "tag_code" => "T1001"}]
               })

      assert "is already on another item" in errors_on(changeset).tag_code
    end

    test "a delivery job needs somewhere to deliver to", ctx do
      assert {:error, changeset} =
               ServiceDesk.take_in(ctx.scope, %{
                 "walk_in_name" => "Imran",
                 "fulfilment" => "delivery",
                 "items" => [%{"description" => "Shirt"}]
               })

      assert "is required for a delivery" in errors_on(changeset).delivery_address
    end
  end

  describe "finding a job" do
    test "by the tag on the garment, which is how a counter works", ctx do
      job = intake(ctx.scope)

      assert {:ok, found} = ServiceDesk.find_by_tag(ctx.scope, "T1002")
      assert found.id == job.id

      # However it was written on the ticket: casing and hyphens are noise.
      assert {:ok, same} = ServiceDesk.find_by_tag(ctx.scope, "t-1002")
      assert same.id == job.id
    end

    test "an unknown tag is a plain not-found", ctx do
      assert {:error, :not_found} = ServiceDesk.find_by_tag(ctx.scope, "NOSUCHTAG")
    end
  end

  describe "working the job" do
    test "marking ready needs a rack location", ctx do
      job = intake(ctx.scope)
      {:ok, job} = ServiceDesk.start(ctx.scope, job)

      assert {:error, changeset} = ServiceDesk.mark_ready(ctx.scope, job, nil)

      assert "is required before a job can be marked ready" in
               errors_on(changeset).rack_location
    end

    test "marking ready racks every item with it", ctx do
      job = intake(ctx.scope)
      {:ok, job} = ServiceDesk.start(ctx.scope, job)
      {:ok, ready} = ServiceDesk.mark_ready(ctx.scope, job, "R3-04")

      assert ready.status == "ready"
      assert ready.rack_location == "R3-04"
      assert Enum.all?(ready.items, &(&1.status == "ready"))
      assert Enum.all?(ready.items, &(&1.rack_location == "R3-04"))
    end

    test "moving one item is recorded, because a lost trail is a lost coat", ctx do
      job = intake(ctx.scope)
      coat = Enum.find(job.items, &(&1.description == "Grey coat"))

      {:ok, moved} = ServiceDesk.move_item(ctx.scope, job, coat.id, "R9-01")
      assert moved.rack_location == "R9-01"

      events = ServiceDesk.history(ctx.scope, job)
      assert Enum.any?(events, &(&1.kind == "moved" and &1.summary =~ "R9-01"))
    end

    test "an incident is a state on the item, not a note", ctx do
      job = intake(ctx.scope)
      coat = Enum.find(job.items, &(&1.description == "Grey coat"))

      {:ok, flagged} =
        ServiceDesk.report_incident(ctx.scope, job, coat.id, "damaged", "Tear at the seam")

      assert flagged.status == "damaged"

      # Recorded, but held back from what the customer is shown until somebody
      # decides how to tell them.
      all = ServiceDesk.history(ctx.scope, job)
      shown = ServiceDesk.history(ctx.scope, job, customer_visible: true)
      assert Enum.any?(all, &(&1.kind == "issue"))
      refute Enum.any?(shown, &(&1.kind == "issue"))
    end
  end

  describe "handing work back" do
    setup ctx do
      job = intake(ctx.scope)
      {:ok, job} = ServiceDesk.start(ctx.scope, job)
      {:ok, job} = ServiceDesk.mark_ready(ctx.scope, job, "R3-04")
      Map.put(ctx, :job, job)
    end

    test "is refused while money is owed", ctx do
      assert {:error, {:balance_due, owed}} = ServiceDesk.deliver(ctx.scope, ctx.job)
      assert Decimal.equal?(owed, Decimal.new("800.00"))
    end

    test "goes through once the bill is settled", ctx do
      {:ok, paid} =
        ServiceDesk.update_job(ctx.scope, ctx.job, %{"advance_paid" => "800.00"})

      assert Money.zero?(Job.balance_due(paid))

      {:ok, delivered} = ServiceDesk.deliver(ctx.scope, paid)
      assert delivered.status == "delivered"
      assert Enum.all?(delivered.items, &(&1.status == "delivered"))
    end

    test "can be forced, for a shop that chooses to", ctx do
      {:ok, delivered} = ServiceDesk.deliver(ctx.scope, ctx.job, allow_unpaid: true)
      assert delivered.status == "delivered"
    end
  end

  describe "the overdue list" do
    test "shows what has missed its promise and is still in the shop", ctx do
      _on_time = intake(ctx.scope)

      late =
        intake(ctx.scope, %{
          "promised_on" => Date.add(Date.utc_today(), -2),
          "items" => [%{"description" => "Late shirt", "tag_code" => "T2001"}]
        })

      assert [only] = ServiceDesk.overdue(ctx.scope)
      assert only.id == late.id
      assert Job.overdue?(only, Date.utc_today())
    end

    test "stops flagging once the work is out", ctx do
      late =
        intake(ctx.scope, %{
          "promised_on" => Date.add(Date.utc_today(), -2),
          "items" => [%{"description" => "Late shirt", "tag_code" => "T2002"}]
        })

      {:ok, late} = ServiceDesk.mark_ready(ctx.scope, late, "R1-01")
      {:ok, _delivered} = ServiceDesk.deliver(ctx.scope, late, allow_unpaid: true)

      assert ServiceDesk.overdue(ctx.scope) == []
    end

    test "the promise itself never moves", ctx do
      job = intake(ctx.scope)
      promised = job.promised_on

      {:ok, job} = ServiceDesk.start(ctx.scope, job)
      {:ok, job} = ServiceDesk.mark_ready(ctx.scope, job, "R1-01")

      # A shop that rewrites its promise when work runs late can never see that
      # it runs late.
      assert job.promised_on == promised
    end
  end
end
