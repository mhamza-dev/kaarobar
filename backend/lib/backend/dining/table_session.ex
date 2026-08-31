defmodule Kaarobar.Dining.TableSession do
  @moduledoc """
  One party, at one table, for one sitting.

  This is the thing a restaurant actually manages. The table is furniture; the
  session is who is on it, since when, how many, who is serving, and what they
  have run up. Without it a table holds exactly one bill and its history is
  erased on clearing, so "how long is that table taking?" and "who served the
  party that walked out?" have no answer.

  The bill is an ordinary `Kaarobar.Sales.Order`, not a parallel notion of an
  unpaid sale — so holding, splitting and billing all work here with no new
  machinery.

  ## Merging

  Two tables pushed together is one bill on two tables. The absorbed session
  keeps its row with `merged_into_id` set, rather than being deleted, because
  those covers really were seated there and turnover reporting has to count
  them where they sat.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Dining.DiningTable
  alias Kaarobar.Sales.Order
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(open billed closed merged)
  # States in which the party is still at the table.
  @live_statuses ~w(open billed)

  schema "table_sessions" do
    field :status, :string, default: "open"
    field :covers, :integer, default: 1
    field :label, :string

    field :opened_at, :utc_datetime_usec
    field :closed_at, :utc_datetime_usec
    field :notes, :string

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :dining_table, DiningTable
    belongs_to :order, Order
    belongs_to :opened_by, User
    belongs_to :server, User
    belongs_to :merged_into, __MODULE__

    timestamps()
  end

  @doc "The states a sitting moves through."
  def statuses, do: @statuses

  @doc "Changeset for seating a party."
  def open_changeset(session, attrs) do
    session
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :branch_id,
      :dining_table_id,
      :order_id,
      :covers,
      :label,
      :server_id,
      :opened_by_id,
      :notes
    ])
    |> validate_required([:organization_id, :business_id, :branch_id, :dining_table_id])
    |> validate_number(:covers, greater_than: 0, less_than_or_equal_to: 200)
    |> put_change(:status, "open")
    |> put_change(:opened_at, DateTime.utc_now())
    |> unique_constraint(:dining_table_id,
      name: :table_sessions_single_open_index,
      message: "already has a party seated"
    )
    |> foreign_key_constraint(:dining_table_id)
  end

  @doc "Changeset for editing a live sitting — covers, server, notes."
  def changeset(session, attrs) do
    session
    |> cast(attrs, [:covers, :label, :server_id, :notes, :order_id])
    |> validate_number(:covers, greater_than: 0, less_than_or_equal_to: 200)
  end

  @doc "Marks the bill as printed. The party is still sitting there."
  def bill_changeset(session), do: change(session, status: "billed")

  @doc "Clears the table."
  def close_changeset(session),
    do: change(session, status: "closed", closed_at: DateTime.utc_now())

  @doc """
  Folds this sitting into another.

  Keeps the row so the covers stay counted at the table they were seated at.
  """
  def merge_changeset(session, %__MODULE__{} = target) do
    change(session,
      status: "merged",
      merged_into_id: target.id,
      closed_at: DateTime.utc_now()
    )
  end

  @doc "Moves the party to a different table, keeping the same bill."
  def transfer_changeset(session, %DiningTable{} = table) do
    session
    |> change(dining_table_id: table.id)
    |> unique_constraint(:dining_table_id,
      name: :table_sessions_single_open_index,
      message: "already has a party seated"
    )
  end

  @doc "True when the party is still at the table."
  @spec live?(t()) :: boolean()
  def live?(%__MODULE__{status: status}), do: status in @live_statuses

  @doc """
  How long the party has been seated, in minutes.

  The clock is derived from `opened_at` rather than stored, because a stored
  duration stops being true the moment it is written.
  """
  @spec minutes_seated(t(), DateTime.t()) :: non_neg_integer()
  def minutes_seated(%__MODULE__{opened_at: nil}, _now), do: 0

  def minutes_seated(%__MODULE__{} = session, now) do
    finish = session.closed_at || now
    finish |> DateTime.diff(session.opened_at, :second) |> div(60) |> max(0)
  end
end
