defmodule Kaarobar.Customers.FollowUp do
  @moduledoc """
  Something that has to happen, by a date, by a named person.

  Kept apart from `Kaarobar.Customers.CustomerNote` because they answer
  different questions. A note records what happened; a follow-up records what
  is owed. Merging them gives a list nobody can act on, because there is no way
  to ask it what is due today.

  `payment_chase` is a kind of its own rather than a plain task: chasing a debt
  is the single most common follow-up a shop has, and naming it lets the
  overdue list generate them.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Customers.Customer
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @kinds ~w(task call visit payment_chase delivery other)
  @statuses ~w(open done cancelled)

  schema "customer_follow_ups" do
    field :title, :string
    field :body, :string
    field :kind, :string, default: "task"
    field :status, :string, default: "open"

    field :due_on, :date
    field :completed_at, :utc_datetime_usec
    field :outcome, :string

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :customer, Customer
    belongs_to :assigned_to, User
    belongs_to :completed_by, User
    belongs_to :created_by, User

    timestamps()
  end

  @doc "What a follow-up can be."
  def kinds, do: @kinds

  @doc "The states a follow-up moves through."
  def statuses, do: @statuses

  def changeset(follow_up, attrs) do
    follow_up
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :customer_id,
      :title,
      :body,
      :kind,
      :due_on,
      :assigned_to_id,
      :created_by_id
    ])
    |> validate_required([:organization_id, :business_id, :customer_id, :title, :due_on])
    |> update_change(:title, &String.trim/1)
    |> validate_length(:title, min: 1, max: 160)
    |> validate_inclusion(:kind, @kinds)
    |> foreign_key_constraint(:customer_id)
  end

  @doc """
  Closes a follow-up.

  An outcome is required. "Done" with nothing said is indistinguishable from
  someone clearing their list, and the next person to ring this customer needs
  to know what was agreed.
  """
  def complete_changeset(follow_up, user_id, outcome) do
    follow_up
    |> cast(%{outcome: outcome}, [:outcome])
    |> validate_required([:outcome], message: "is required to close a follow-up")
    |> validate_length(:outcome, min: 1, max: 2000)
    |> put_change(:status, "done")
    |> put_change(:completed_at, DateTime.utc_now())
    |> put_change(:completed_by_id, user_id)
  end

  @doc "Abandons a follow-up without doing it."
  def cancel_changeset(follow_up, user_id, reason) do
    follow_up
    |> change(
      status: "cancelled",
      completed_at: DateTime.utc_now(),
      completed_by_id: user_id,
      outcome: reason
    )
  end

  @doc "True when this is still outstanding."
  @spec open?(t()) :: boolean()
  def open?(%__MODULE__{status: "open"}), do: true
  def open?(%__MODULE__{}), do: false

  @doc "True when it is open and its date has passed."
  @spec overdue?(t(), Date.t()) :: boolean()
  def overdue?(%__MODULE__{status: "open", due_on: due}, today), do: Date.compare(due, today) == :lt
  def overdue?(%__MODULE__{}, _today), do: false
end
