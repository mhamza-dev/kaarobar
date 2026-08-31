defmodule Kaarobar.ServiceDesk.JobEvent do
  @moduledoc """
  What happened to the customer's property while the shop had it.

  Append-only, and deliberately separate from `Kaarobar.Audit`: the audit log
  is for the shop and its regulators, this is for the customer. "Where is my
  coat?" is answered from here, and the answer has to be showable to the person
  asking — which an audit trail full of internal notes and actor ids is not.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.ServiceDesk.Job
  alias Kaarobar.ServiceDesk.JobItem
  alias Kaarobar.Tenancy.Business

  @kinds ~w(received started ready delivered cancelled moved note issue notified)

  schema "service_job_events" do
    field :kind, :string
    field :summary, :string
    field :detail, :string

    field :actor_label, :string
    field :occurred_at, :utc_datetime_usec

    belongs_to :business, Business
    belongs_to :service_job, Job
    belongs_to :service_job_item, JobItem
    belongs_to :actor_user, User

    timestamps(updated_at: false)
  end

  @doc "The things that can happen to a job."
  def kinds, do: @kinds

  def changeset(event, attrs) do
    event
    |> cast(attrs, [
      :business_id,
      :service_job_id,
      :service_job_item_id,
      :kind,
      :summary,
      :detail,
      :actor_user_id,
      :actor_label,
      :occurred_at
    ])
    |> validate_required([:business_id, :service_job_id, :kind, :summary])
    |> validate_inclusion(:kind, @kinds)
    |> validate_length(:summary, min: 1, max: 200)
    |> put_occurred_at()
    |> foreign_key_constraint(:service_job_id)
  end

  @doc """
  True when this entry is fit to show the customer.

  An `issue` is the shop's own record of something going wrong and is held back
  until somebody decides how to tell them.
  """
  @spec customer_visible?(t()) :: boolean()
  def customer_visible?(%__MODULE__{kind: "issue"}), do: false
  def customer_visible?(%__MODULE__{}), do: true

  defp put_occurred_at(changeset) do
    case get_field(changeset, :occurred_at) do
      nil -> put_change(changeset, :occurred_at, DateTime.utc_now())
      _set -> changeset
    end
  end
end
