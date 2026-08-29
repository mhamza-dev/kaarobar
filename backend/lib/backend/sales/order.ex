defmodule Kaarobar.Sales.Order do
  @moduledoc """
  An open ticket: items chosen, money not yet taken.

  One model serving several shapes of the same idea — a restaurant table's
  running tab, a salon client's visit, a laundry job built up at the counter, a
  retail sale parked while the customer fetches their wallet. All of them need
  to survive the cashier turning away to serve someone else.

  ## An order is not a sale

  It moves no stock, takes no payment and has no invoice number. Billing it
  creates a `Kaarobar.Sales.Sale`, which does all three. That separation is
  what lets a ticket be edited freely — a restaurant order changes half a dozen
  times before it is paid — while a sale, once rung, is a financial record that
  only a void or a refund may alter.

  ## The totals here are indicative

  They are kept current so a ticket can be shown without recomputing, but the
  authoritative figures come from `Kaarobar.Sales.Checkout` at the moment of
  billing: a promotion may have started or ended since the ticket opened, and
  the price the customer pays is the price at the till.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Customers.Customer
  alias Kaarobar.Money
  alias Kaarobar.Registers.Register
  alias Kaarobar.Sales.OrderItem
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(open held billed cancelled)
  @channels ~w(pos online phone wholesale)
  @service_modes ~w(dine_in takeaway delivery)
  # Statuses from which a ticket may still be changed or billed.
  @live_statuses ~w(open held)

  schema "orders" do
    field :number, :string
    field :status, :string, default: "open"
    field :channel, :string, default: "pos"

    field :label, :string
    field :service_mode, :string

    field :subtotal, :decimal, default: Decimal.new(0)
    field :discount_total, :decimal, default: Decimal.new(0)
    field :tax_total, :decimal, default: Decimal.new(0)
    field :total, :decimal, default: Decimal.new(0)

    field :notes, :string

    field :opened_at, :utc_datetime_usec
    field :billed_at, :utc_datetime_usec
    field :cancelled_at, :utc_datetime_usec
    field :cancel_reason, :string

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :register, Register
    belongs_to :customer, Customer
    belongs_to :served_by_user, User
    belongs_to :opened_by, User

    has_many :items, OrderItem, preload_order: [asc: :position]

    timestamps()
  end

  @doc "The states a ticket moves through."
  def statuses, do: @statuses

  @doc "Where an order came from."
  def channels, do: @channels

  @doc "How the food is served, for verticals that require it."
  def service_modes, do: @service_modes

  def changeset(order, attrs) do
    order
    |> cast(attrs, [
      :branch_id,
      :register_id,
      :customer_id,
      :channel,
      :label,
      :service_mode,
      :served_by_user_id,
      :notes
    ])
    |> validate_required([:branch_id])
    |> validate_inclusion(:channel, @channels)
    |> validate_inclusion(:service_mode, @service_modes)
    |> validate_length(:label, max: 80)
    |> unique_constraint(:number,
      name: :orders_business_id_number_index
    )
    |> foreign_key_constraint(:branch_id)
    |> foreign_key_constraint(:customer_id)
  end

  @doc "Changeset for a newly opened ticket, once its number has been drawn."
  def open_changeset(order, attrs) do
    order
    |> changeset(attrs)
    |> cast(attrs, [:organization_id, :business_id, :number, :opened_by_id])
    |> validate_required([:organization_id, :business_id, :number])
    |> put_change(:status, "open")
    |> put_change(:opened_at, DateTime.utc_now())
  end

  @doc "Parks a ticket so the till is free for the next customer."
  def hold_changeset(order), do: change(order, status: "held")

  @doc "Brings a parked ticket back to the till."
  def resume_changeset(order), do: change(order, status: "open")

  @doc """
  Marks the ticket billed.

  Only called once every line is fully billed; a partly-billed ticket stays
  open so the rest of the table can pay.
  """
  def bill_changeset(order),
    do: change(order, status: "billed", billed_at: DateTime.utc_now())

  @doc "Abandons a ticket. A reason is required, because someone will ask."
  def cancel_changeset(order, reason) do
    order
    |> change(status: "cancelled", cancelled_at: DateTime.utc_now(), cancel_reason: reason)
    |> validate_required([:cancel_reason], message: "is required to cancel an order")
  end

  @doc "Recomputes the indicative totals from the loaded lines."
  def totals_changeset(order, totals) do
    change(order,
      subtotal: Money.round(totals.subtotal),
      discount_total: Money.round(totals.discount_total),
      tax_total: Money.round(totals.tax_total),
      total: Money.round(totals.total)
    )
  end

  @doc "True when the ticket may still be changed or billed."
  @spec live?(t()) :: boolean()
  def live?(%__MODULE__{status: status}), do: status in @live_statuses

  @doc """
  True when every line has been paid for.

  A restaurant table paying by cover bills the same ticket several times; it is
  finished only when nothing is left unbilled.
  """
  @spec fully_billed?(t()) :: boolean()
  def fully_billed?(%__MODULE__{items: items}) when is_list(items),
    do: items != [] and Enum.all?(items, &OrderItem.fully_billed?/1)

  def fully_billed?(%__MODULE__{}), do: false
end
