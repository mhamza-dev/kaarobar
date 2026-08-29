defmodule Kaarobar.Inventory.StockCount do
  @moduledoc """
  A stock take: what the system believed, what was actually on the shelf, and
  the correction between them.

  **Nothing changes until it is approved.** A count is precisely when a typo
  becomes a permanent, unexplained correction — someone keys 100 instead of 10
  and the shop writes off ninety units it still owns. So counting records
  findings, and approval turns the differences into ledger moves.

  The variance summary on the header exists so an approver sees the size of
  what they are accepting before opening the lines. A count that proposes to
  write off a tenth of the stockroom should look alarming at a glance.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Catalog.Category
  alias Kaarobar.Inventory.StockCountItem
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(draft counting awaiting_approval approved cancelled)
  @kinds ~w(full cycle spot)

  schema "stock_counts" do
    field :number, :string
    field :status, :string, default: "draft"
    field :kind, :string, default: "cycle"

    field :started_at, :utc_datetime_usec
    field :counted_at, :utc_datetime_usec
    field :approved_at, :utc_datetime_usec
    field :cancelled_at, :utc_datetime_usec

    field :variance_quantity, :decimal, default: Decimal.new(0)
    field :variance_value, :decimal, default: Decimal.new(0)
    field :line_count, :integer, default: 0

    field :notes, :string

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :category, Category
    belongs_to :created_by, User
    belongs_to :approved_by, User

    has_many :items, StockCountItem

    timestamps()
  end

  @doc "The states a count moves through."
  def statuses, do: @statuses

  @doc "How much of the shop is being counted."
  def kinds, do: @kinds

  def changeset(count, attrs) do
    count
    |> cast(attrs, [:branch_id, :kind, :category_id, :notes])
    |> validate_required([:branch_id, :kind])
    |> validate_inclusion(:kind, @kinds)
    |> validate_length(:notes, max: 1000)
    |> unique_constraint([:business_id, :number], message: "is already used")
    |> foreign_key_constraint(:branch_id)
  end

  @doc "Changeset for submitting a finished count for approval."
  def submit_changeset(count, summary) do
    change(count, %{
      status: "awaiting_approval",
      counted_at: DateTime.utc_now(),
      variance_quantity: summary.variance_quantity,
      variance_value: summary.variance_value,
      line_count: summary.line_count
    })
  end

  @doc "Changeset for approving: the corrections are about to be posted."
  def approve_changeset(count, user_id) do
    change(count, status: "approved", approved_at: DateTime.utc_now(), approved_by_id: user_id)
  end

  @doc "Changeset for abandoning a count without touching stock."
  def cancel_changeset(count) do
    change(count, status: "cancelled", cancelled_at: DateTime.utc_now())
  end

  @doc "True when lines may still be counted or edited."
  def open?(%__MODULE__{status: status}), do: status in ["draft", "counting"]

  @doc "True when the count is finished and waiting on someone to accept it."
  def awaiting_approval?(%__MODULE__{status: "awaiting_approval"}), do: true
  def awaiting_approval?(%__MODULE__{}), do: false
end
