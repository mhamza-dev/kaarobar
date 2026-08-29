defmodule Kaarobar.Sales.RefundRequest do
  @moduledoc """
  A request to give money back, and the decision on it.

  The cashier who made the mistake should not be the one who approves undoing
  it. `sale:refund_request` and `sale:refund_approve` have been separate
  permissions since the access-control phase; this is what makes the separation
  real rather than nominal.

  A one-person shop grants itself both permissions and the request approves
  immediately. A shop with a supervisor gets a queue, and a record of who
  authorised what — which is the first thing anyone looks at when the week's
  takings are short.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Sales.RefundRequestItem
  alias Kaarobar.Sales.Sale
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(pending approved rejected completed)

  schema "refund_requests" do
    field :number, :string
    field :status, :string, default: "pending"

    field :reason, :string
    field :requested_amount, :decimal

    field :requested_at, :utc_datetime_usec
    field :reviewed_at, :utc_datetime_usec
    field :review_note, :string

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :sale, Sale
    belongs_to :requested_by, User
    belongs_to :reviewed_by, User

    has_many :items, RefundRequestItem

    timestamps()
  end

  @doc "The states a request moves through."
  def statuses, do: @statuses

  @doc "Changeset for raising a request."
  def create_changeset(request, attrs) do
    request
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :branch_id,
      :sale_id,
      :number,
      :reason,
      :requested_amount,
      :requested_by_id
    ])
    |> validate_required([
      :organization_id,
      :business_id,
      :branch_id,
      :sale_id,
      :number,
      :reason
    ])
    |> validate_length(:reason, min: 1, max: 240)
    |> validate_number(:requested_amount, greater_than: 0)
    |> put_change(:status, "pending")
    |> put_change(:requested_at, DateTime.utc_now())
    |> unique_constraint(:number,
      name: :refund_requests_business_id_number_index
    )
    |> foreign_key_constraint(:sale_id)
  end

  @doc "Records a decision. Only a pending request may be decided."
  def review_changeset(request, status, user_id, note \\ nil) do
    request
    |> change(
      status: status,
      reviewed_by_id: user_id,
      reviewed_at: DateTime.utc_now(),
      review_note: note
    )
    |> validate_inclusion(:status, ~w(approved rejected))
    |> validate_rejection_has_note()
  end

  @doc "Marks an approved request as having been paid out."
  def complete_changeset(request), do: change(request, status: "completed")

  @doc "True when the request is still awaiting a decision."
  @spec pending?(t()) :: boolean()
  def pending?(%__MODULE__{status: "pending"}), do: true
  def pending?(%__MODULE__{}), do: false

  @doc "True when money may now be paid out against this request."
  @spec approved?(t()) :: boolean()
  def approved?(%__MODULE__{status: "approved"}), do: true
  def approved?(%__MODULE__{}), do: false

  # Turning a customer down without saying why leaves the next member of staff
  # unable to answer when they come back and ask.
  defp validate_rejection_has_note(changeset) do
    if get_field(changeset, :status) == "rejected" do
      validate_required(changeset, [:review_note], message: "is required when rejecting")
    else
      changeset
    end
  end
end
