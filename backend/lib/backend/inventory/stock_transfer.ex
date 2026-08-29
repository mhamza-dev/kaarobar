defmodule Kaarobar.Inventory.StockTransfer do
  @moduledoc """
  Stock moving from one branch to another.

  Three states, because vans exist. Dispatching writes `transfer_out` at the
  source; receiving writes `transfer_in` at the destination; in between, the
  goods belong to neither branch and the transfer is what says where they are.

  Modelling this as one instantaneous move would make "what is on the road"
  unanswerable, and a shop that transfers weekly always has some stock in that
  state. It would also hide the discrepancy that matters most: when less
  arrives than left.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Inventory.StockTransferItem
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(draft dispatched received cancelled)

  schema "stock_transfers" do
    field :number, :string
    field :status, :string, default: "draft"

    field :dispatched_at, :utc_datetime_usec
    field :received_at, :utc_datetime_usec
    field :cancelled_at, :utc_datetime_usec

    field :notes, :string

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :source_branch, Branch
    belongs_to :destination_branch, Branch
    belongs_to :created_by, User
    belongs_to :dispatched_by, User
    belongs_to :received_by, User

    has_many :items, StockTransferItem, preload_order: [asc: :position]

    timestamps()
  end

  @doc "The states a transfer moves through."
  def statuses, do: @statuses

  def changeset(transfer, attrs) do
    transfer
    |> cast(attrs, [:source_branch_id, :destination_branch_id, :notes])
    |> validate_required([:source_branch_id, :destination_branch_id])
    |> validate_distinct_branches()
    |> validate_length(:notes, max: 1000)
    |> unique_constraint(:number, name: :stock_transfers_business_id_number_index, message: "is already used")
    |> foreign_key_constraint(:source_branch_id)
    |> foreign_key_constraint(:destination_branch_id)
  end

  @doc "Changeset for dispatching: goods have left the source branch."
  def dispatch_changeset(transfer, user_id) do
    change(transfer,
      status: "dispatched",
      dispatched_at: DateTime.utc_now(),
      dispatched_by_id: user_id
    )
  end

  @doc "Changeset for receiving: goods have arrived at the destination."
  def receive_changeset(transfer, user_id) do
    change(transfer,
      status: "received",
      received_at: DateTime.utc_now(),
      received_by_id: user_id
    )
  end

  @doc "Changeset for cancelling a transfer that has not left yet."
  def cancel_changeset(transfer) do
    change(transfer, status: "cancelled", cancelled_at: DateTime.utc_now())
  end

  @doc "True when the transfer may still be edited."
  def editable?(%__MODULE__{status: "draft"}), do: true
  def editable?(%__MODULE__{}), do: false

  @doc "True when the goods are on the road: gone from one branch, not yet at the other."
  def in_transit?(%__MODULE__{status: "dispatched"}), do: true
  def in_transit?(%__MODULE__{}), do: false

  @doc """
  Lines where less arrived than was sent.

  The only signal a shop gets that something is going missing between two of
  its own branches, so it is surfaced rather than averaged into the count.
  """
  @spec discrepancies(t()) :: [StockTransferItem.t()]
  def discrepancies(%__MODULE__{items: items}) when is_list(items),
    do: Enum.filter(items, &StockTransferItem.short?/1)

  def discrepancies(%__MODULE__{}), do: []

  defp validate_distinct_branches(changeset) do
    source = get_field(changeset, :source_branch_id)
    destination = get_field(changeset, :destination_branch_id)

    if source && source == destination do
      add_error(changeset, :destination_branch_id, "must differ from the source branch")
    else
      changeset
    end
  end
end
