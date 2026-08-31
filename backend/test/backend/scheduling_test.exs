defmodule Kaarobar.SchedulingTest do
  @moduledoc """
  The salon flow: book a visit against a stylist, refuse a clash, work the
  queue, and free the slot when somebody cancels.
  """

  use Kaarobar.DataCase, async: true

  alias Kaarobar.Scheduling

  setup do
    %{scope: scope} = owner_scope(business_type: "salon")

    ayesha = resource(scope, "Ayesha")
    basin = resource(scope, "Basin 1", "room")

    cut = service(scope, "Cut", "1500.00", 30)
    colour = service(scope, "Colour", "6000.00", 90)

    %{scope: scope, ayesha: ayesha, basin: basin, cut: cut, colour: colour}
  end

  defp resource(scope, name, kind \\ "staff") do
    {:ok, resource} = Scheduling.create_resource(scope, %{"name" => name, "kind" => kind})
    resource
  end

  defp service(scope, name, price, minutes) do
    product =
      product_fixture(scope, %{
        "name" => name,
        "price" => price,
        "kind" => "service",
        "tracks_stock" => false,
        "service_duration_minutes" => minutes
      })

    [variant] = Kaarobar.Catalog.list_variants(scope, product)
    variant
  end

  defp at(hour, minute \\ 0) do
    Date.utc_today()
    |> Date.add(1)
    |> DateTime.new!(Time.new!(hour, minute, 0), "Etc/UTC")
  end

  defp booking(ctx, variant, resource, starts_at, extra \\ %{}) do
    Map.merge(
      %{
        "walk_in_name" => "Sana",
        "services" => [
          %{
            "variant_id" => variant.id,
            "resource_id" => resource.id,
            "starts_at" => DateTime.to_iso8601(starts_at)
          }
        ]
      },
      extra
    )
    |> then(&Scheduling.book(ctx.scope, &1))
  end

  describe "booking" do
    test "takes the duration from the catalogue, not the request", ctx do
      {:ok, appointment} = booking(ctx, ctx.colour, ctx.ayesha, at(10))

      assert [service] = appointment.services
      # A 90-minute colour, however the client was told to describe it.
      assert service.duration_minutes == 90
      assert DateTime.diff(service.ends_at, service.starts_at) == 90 * 60
      assert {:ok, _reloaded} = Scheduling.fetch_appointment(ctx.scope, appointment.id)
    end

    test "spans its services", ctx do
      {:ok, appointment} =
        Scheduling.book(ctx.scope, %{
          "walk_in_name" => "Sana",
          "services" => [
            %{
              "variant_id" => ctx.cut.id,
              "resource_id" => ctx.ayesha.id,
              "starts_at" => DateTime.to_iso8601(at(10))
            },
            %{
              "variant_id" => ctx.colour.id,
              "resource_id" => ctx.basin.id,
              "starts_at" => DateTime.to_iso8601(at(10, 30))
            }
          ]
        })

      assert length(appointment.services) == 2
      assert appointment.starts_at == at(10)
      # 10:30 plus ninety minutes.
      assert appointment.ends_at == at(12)
    end

    test "refuses to double-book a resource, from the database", ctx do
      {:ok, _first} = booking(ctx, ctx.cut, ctx.ayesha, at(10))

      # An overlapping slot on the same stylist. Two receptionists doing this at
      # once is the ordinary case, which is why the constraint is in Postgres.
      assert {:error, changeset} = booking(ctx, ctx.cut, ctx.ayesha, at(10, 15))
      assert "is already booked for that time" in errors_on(changeset).resource_id
    end

    test "the same time on a different resource is fine", ctx do
      {:ok, _first} = booking(ctx, ctx.cut, ctx.ayesha, at(10))
      assert {:ok, _second} = booking(ctx, ctx.cut, ctx.basin, at(10))
    end

    test "back-to-back bookings do not clash", ctx do
      {:ok, _first} = booking(ctx, ctx.cut, ctx.ayesha, at(10))
      # The period is half-open, so 10:30 is free the moment 10:00–10:30 ends.
      assert {:ok, _second} = booking(ctx, ctx.cut, ctx.ayesha, at(10, 30))
    end

    test "a booking with no services is refused", ctx do
      assert {:error, :services_required} =
               Scheduling.book(ctx.scope, %{"walk_in_name" => "Sana", "services" => []})
    end

    test "a walk-in needs no customer record", ctx do
      {:ok, appointment} = booking(ctx, ctx.cut, ctx.ayesha, at(11))
      assert appointment.customer_id == nil
      assert Kaarobar.Scheduling.Appointment.who(appointment) == "Sana"
    end
  end

  describe "availability" do
    test "excludes what is already booked", ctx do
      day = Date.add(Date.utc_today(), 1)
      before_booking = Scheduling.availability(ctx.scope, ctx.ayesha, day, duration_minutes: 30)

      {:ok, _appointment} = booking(ctx, ctx.cut, ctx.ayesha, at(10))

      after_booking = Scheduling.availability(ctx.scope, ctx.ayesha, day, duration_minutes: 30)

      assert length(after_booking) < length(before_booking)
      refute Enum.any?(after_booking, &(&1.starts_at == at(10)))
    end

    test "a longer service needs a longer gap", ctx do
      day = Date.add(Date.utc_today(), 1)

      short = Scheduling.availability(ctx.scope, ctx.ayesha, day, duration_minutes: 30)
      long = Scheduling.availability(ctx.scope, ctx.ayesha, day, duration_minutes: 90)

      # Fewer 90-minute windows fit in a day than 30-minute ones.
      assert length(long) < length(short)
    end

    test "a resource that cannot be booked offers nothing", ctx do
      {:ok, off} = Scheduling.update_resource(ctx.scope, ctx.ayesha, %{"is_bookable" => false})
      day = Date.add(Date.utc_today(), 1)

      assert Scheduling.availability(ctx.scope, off, day) == []
    end
  end

  describe "cancelling" do
    test "frees the slot for somebody else", ctx do
      {:ok, appointment} = booking(ctx, ctx.cut, ctx.ayesha, at(10))
      assert {:error, _clash} = booking(ctx, ctx.cut, ctx.ayesha, at(10))

      {:ok, cancelled} = Scheduling.cancel(ctx.scope, appointment, "Customer called")
      assert cancelled.status == "cancelled"

      # The slot is immediately rebookable — the constraint ignores cancelled
      # rows, which is the whole reason they are marked rather than deleted.
      assert {:ok, _rebooked} = booking(ctx, ctx.cut, ctx.ayesha, at(10))
    end

    test "a no-show is recorded apart from a cancellation", ctx do
      {:ok, appointment} = booking(ctx, ctx.cut, ctx.ayesha, at(10))
      {:ok, marked} = Scheduling.no_show(ctx.scope, appointment)

      assert marked.status == "no_show"
      assert marked.no_show_at
      assert is_nil(marked.cancelled_at)
    end
  end

  describe "the walk-in queue" do
    test "holds no slot, so it blocks nobody", ctx do
      {:ok, _waiting} = Scheduling.join_queue(ctx.scope, %{"name" => "Bilal"})

      # Somebody on the bench does not stop a booking being taken.
      assert {:ok, _booked} = booking(ctx, ctx.cut, ctx.ayesha, at(10))
      assert [%{entry: entry, minutes_waiting: 0}] = Scheduling.queue(ctx.scope)
      assert entry.name == "Bilal"
    end

    test "seating turns the wait into a booking", ctx do
      {:ok, entry} = Scheduling.join_queue(ctx.scope, %{"name" => "Bilal"})

      {:ok, result} =
        Scheduling.seat_from_queue(ctx.scope, entry, %{
          "services" => [
            %{
              "variant_id" => ctx.cut.id,
              "resource_id" => ctx.ayesha.id,
              "starts_at" => DateTime.to_iso8601(at(14))
            }
          ]
        })

      assert result.entry.status == "seated"
      assert result.entry.appointment_id == result.appointment.id
      # And they are off the bench.
      assert Scheduling.queue(ctx.scope) == []
    end

    test "somebody who gives up is counted", ctx do
      {:ok, entry} = Scheduling.join_queue(ctx.scope, %{"name" => "Bilal"})
      {:ok, gone} = Scheduling.leave_queue(ctx.scope, entry, "left")

      assert gone.status == "left"
      assert gone.left_at
      assert Scheduling.queue(ctx.scope) == []
    end
  end

  describe "the diary" do
    test "returns every resource, including empty ones", ctx do
      {:ok, _appointment} = booking(ctx, ctx.cut, ctx.ayesha, at(10))
      day = Date.add(Date.utc_today(), 1)

      columns = Scheduling.day_view(ctx.scope, day)

      assert length(columns) == 2
      busy = Enum.find(columns, &(&1.resource.id == ctx.ayesha.id))
      idle = Enum.find(columns, &(&1.resource.id == ctx.basin.id))

      assert length(busy.services) == 1
      # An empty column is information: it is where the shop has capacity.
      assert idle.services == []
    end
  end
end
