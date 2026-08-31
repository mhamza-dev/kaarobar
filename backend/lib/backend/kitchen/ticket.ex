defmodule Kaarobar.Kitchen.Ticket do
  @moduledoc """
  One station's share of one course of one order.

  An order becomes several tickets because it goes to several places at once.
  Splitting by station is the whole reason a kitchen display exists rather than
  a printer: each station sees only its own work and bumps it independently, so
  the pass can tell that the grill is done and the fryer is not.

  ## The clock is derived

  `fired_at` and `bumped_at` are stamps, and elapsed time is computed from
  them. A stored "minutes waiting" stops being true the moment it is written,
  and the number the pass is watching is exactly the one that must not go
  stale.

  ## Everything the screen needs is copied onto it

  Table, service mode and server are snapshotted so the display needs no joins
  and still reads correctly after the table has been cleared and reseated.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Kitchen.Station
  alias Kaarobar.Kitchen.TicketItem
  alias Kaarobar.Sales.Order
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(fired preparing ready bumped cancelled)
  # States in which the ticket is still the kitchen's problem.
  @live_statuses ~w(fired preparing ready)

  schema "kitchen_tickets" do
    field :number, :string
    field :status, :string, default: "fired"
    field :course, :integer, default: 1

    field :table_label, :string
    field :service_mode, :string
    field :server_label, :string

    field :is_priority, :boolean, default: false
    field :notes, :string

    field :fired_at, :utc_datetime_usec
    field :started_at, :utc_datetime_usec
    field :bumped_at, :utc_datetime_usec
    field :recalled_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :kitchen_station, Station
    belongs_to :order, Order
    belongs_to :bumped_by, User

    has_many :items, TicketItem,
      foreign_key: :kitchen_ticket_id,
      preload_order: [asc: :position]

    timestamps()
  end

  @doc "The states a ticket moves through."
  def statuses, do: @statuses

  @doc "The states in which the kitchen still owes food."
  def live_statuses, do: @live_statuses

  def changeset(ticket, attrs) do
    ticket
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :branch_id,
      :kitchen_station_id,
      :order_id,
      :number,
      :course,
      :table_label,
      :service_mode,
      :server_label,
      :is_priority,
      :notes,
      :fired_at
    ])
    |> validate_required([
      :organization_id,
      :business_id,
      :branch_id,
      :kitchen_station_id,
      :order_id,
      :number,
      :fired_at
    ])
    |> validate_number(:course, greater_than: 0)
    |> put_change(:status, "fired")
    |> unique_constraint(:number,
      name: :kitchen_tickets_business_id_number_index
    )
    |> foreign_key_constraint(:kitchen_station_id)
    |> foreign_key_constraint(:order_id)
  end

  @doc "Someone has picked the ticket up and started cooking."
  def start_changeset(ticket),
    do: change(ticket, status: "preparing", started_at: DateTime.utc_now())

  @doc "The food is up and waiting at the pass."
  def ready_changeset(ticket), do: change(ticket, status: "ready")

  @doc "Cleared from the screen — the food has gone out."
  def bump_changeset(ticket, user_id),
    do: change(ticket, status: "bumped", bumped_at: DateTime.utc_now(), bumped_by_id: user_id)

  @doc """
  Puts a bumped ticket back on the screen.

  Someone bumps the wrong ticket in every service. Recalling is the fix, and it
  is stamped so a station that recalls constantly is visible.
  """
  def recall_changeset(ticket) do
    change(ticket,
      status: "fired",
      bumped_at: nil,
      bumped_by_id: nil,
      recalled_at: DateTime.utc_now()
    )
  end

  @doc "Kills a ticket whose order was cancelled."
  def cancel_changeset(ticket), do: change(ticket, status: "cancelled")

  @doc "True when the kitchen still owes this food."
  @spec live?(t()) :: boolean()
  def live?(%__MODULE__{status: status}), do: status in @live_statuses

  @doc """
  Minutes since the ticket was fired, or how long it took if it is done.

  What the pass is watching, and what a service report measures.
  """
  @spec elapsed_minutes(t(), DateTime.t()) :: non_neg_integer()
  def elapsed_minutes(%__MODULE__{fired_at: nil}, _now), do: 0

  def elapsed_minutes(%__MODULE__{} = ticket, now) do
    finish = ticket.bumped_at || now
    finish |> DateTime.diff(ticket.fired_at, :second) |> div(60) |> max(0)
  end

  @doc """
  How late the ticket is against the station's usual time.

  Zero when the station has no expected time set, so a kitchen that has never
  configured one simply sees no late warnings rather than every ticket flagged.
  """
  @spec minutes_late(t(), Station.t() | nil, DateTime.t()) :: non_neg_integer()
  def minutes_late(%__MODULE__{}, nil, _now), do: 0
  def minutes_late(%__MODULE__{}, %Station{prep_minutes: nil}, _now), do: 0

  def minutes_late(%__MODULE__{} = ticket, %Station{prep_minutes: expected}, now),
    do: max(elapsed_minutes(ticket, now) - expected, 0)
end
