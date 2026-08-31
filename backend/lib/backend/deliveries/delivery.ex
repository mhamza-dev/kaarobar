defmodule Kaarobar.Deliveries.Delivery do
  @moduledoc """
  An order going out on a bike.

  ## It hangs off whichever exists

  A delivery paid on order has a sale; one paid at the door has only an open
  ticket until the rider comes back. Both `order_id` and `sale_id` are
  nullable and either may be set, because a delivery is real from the moment
  someone promises it — before there is anything to attach it to.

  ## The address is copied

  A customer editing their address next week must not change where last week's
  order was recorded as going. `delivery_notes` is separate from the address
  because directions are not an address: "blue gate past the mosque, ring
  twice" is what actually gets the food delivered and has nowhere else to live.

  ## `collected_amount` is what the rider brought back

  Cash on delivery means the money is out of the shop's control for half an
  hour. Recording what was collected, separately from what was owed, is how a
  short round is noticed the same evening rather than at the end of the month.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Customers.Customer
  alias Kaarobar.Money
  alias Kaarobar.Sales.Order
  alias Kaarobar.Sales.Sale
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(pending assigned picked_up delivered failed cancelled)
  # States in which the order is still out or still owed.
  @live_statuses ~w(pending assigned picked_up)

  schema "deliveries" do
    field :number, :string
    field :status, :string, default: "pending"

    field :rider_label, :string

    field :address_snapshot, :string
    field :phone_snapshot, :string
    field :delivery_notes, :string
    field :latitude, :decimal
    field :longitude, :decimal

    field :fee, :decimal, default: Decimal.new(0)
    field :collected_amount, :decimal

    field :promised_at, :utc_datetime_usec
    field :assigned_at, :utc_datetime_usec
    field :picked_up_at, :utc_datetime_usec
    field :delivered_at, :utc_datetime_usec
    field :failed_at, :utc_datetime_usec
    field :failure_reason, :string

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :order, Order
    belongs_to :sale, Sale
    belongs_to :customer, Customer
    belongs_to :rider_user, User

    timestamps()
  end

  @doc "The states a delivery moves through."
  def statuses, do: @statuses

  @doc "The states in which the order is still out."
  def live_statuses, do: @live_statuses

  def changeset(delivery, attrs) do
    delivery
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :branch_id,
      :order_id,
      :sale_id,
      :customer_id,
      :number,
      :address_snapshot,
      :phone_snapshot,
      :delivery_notes,
      :latitude,
      :longitude,
      :fee,
      :promised_at
    ])
    |> validate_required([
      :organization_id,
      :business_id,
      :branch_id,
      :number,
      :address_snapshot
    ])
    |> validate_length(:address_snapshot, min: 1, max: 500)
    |> validate_number(:fee, greater_than_or_equal_to: 0)
    |> validate_attached()
    |> unique_constraint(:number, name: :deliveries_business_id_number_index)
  end

  @doc "Hands the order to a rider."
  def assign_changeset(delivery, %User{} = rider) do
    change(delivery,
      status: "assigned",
      rider_user_id: rider.id,
      rider_label: rider.name,
      assigned_at: DateTime.utc_now()
    )
  end

  @doc "The rider has the food and has left."
  def pick_up_changeset(delivery),
    do: change(delivery, status: "picked_up", picked_up_at: DateTime.utc_now())

  @doc """
  Delivered, with what the rider collected at the door.

  `collected` is nil for an order already paid for — recording zero would read
  as a rider who came back empty-handed.
  """
  def deliver_changeset(delivery, collected \\ nil) do
    change(delivery,
      status: "delivered",
      delivered_at: DateTime.utc_now(),
      collected_amount: collected && Money.round(collected)
    )
  end

  @doc "Did not get there. A reason is required, and the database agrees."
  def fail_changeset(delivery, reason) do
    delivery
    |> cast(%{failure_reason: reason}, [:failure_reason])
    |> validate_required([:failure_reason], message: "is required when a delivery fails")
    |> validate_length(:failure_reason, min: 3, max: 200)
    |> put_change(:status, "failed")
    |> put_change(:failed_at, DateTime.utc_now())
  end

  @doc "True when the order is still out or still waiting to go."
  @spec live?(t()) :: boolean()
  def live?(%__MODULE__{status: status}), do: status in @live_statuses

  @doc """
  Minutes since the delivery was promised, negative while still in hand.

  Positive means late. Returns nil when nothing was promised, so a shop that
  does not quote times sees no late warnings rather than every order flagged.
  """
  @spec minutes_late(t(), DateTime.t()) :: integer() | nil
  def minutes_late(%__MODULE__{promised_at: nil}, _now), do: nil

  def minutes_late(%__MODULE__{} = delivery, now) do
    finish = delivery.delivered_at || now
    finish |> DateTime.diff(delivery.promised_at, :second) |> div(60)
  end

  # A delivery attached to nothing is a promise nobody can trace back to an
  # order — and it is the rider who ends up carrying the blame for it.
  defp validate_attached(changeset) do
    order_id = get_field(changeset, :order_id)
    sale_id = get_field(changeset, :sale_id)

    if is_nil(order_id) and is_nil(sale_id) do
      add_error(changeset, :order_id, "or a sale is required")
    else
      changeset
    end
  end
end
