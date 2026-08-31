defmodule Kaarobar.Payments.WebhookEvent do
  @moduledoc """
  A callback from a gateway, stored before it is acted on.

  ## Stored first, processed second

  A handler that crashes must not lose the event, because the gateway may not
  send it again — and the one it would not resend is the one that says the
  money arrived.

  ## Unique per provider, which is the whole point

  Every gateway retries; several deliver out of order. The unique index on
  `(provider, external_id)` is what makes a replay a no-op instead of a second
  capture, and that is the difference between a duplicate row and taking a
  customer's money twice.

  ## `signature_verified` is recorded, not assumed

  An unverified callback is an instruction from a stranger to mark a payment as
  paid. Keeping the flag on the row means a later audit can ask whether
  anything was ever acted on without it.
  """

  use Kaarobar.Schema

  alias Kaarobar.Payments.Intent
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(received processed failed ignored)

  schema "webhook_events" do
    field :provider, :string
    field :external_id, :string
    field :event_type, :string

    field :status, :string, default: "received"
    field :signature_verified, :boolean, default: false
    field :payload, :map

    field :attempts, :integer, default: 0
    field :last_error, :string
    field :processed_at, :utc_datetime_usec
    field :received_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :payment_intent, Intent

    timestamps()
  end

  @doc "The states an event moves through."
  def statuses, do: @statuses

  def changeset(event, attrs) do
    event
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :provider,
      :external_id,
      :event_type,
      :signature_verified,
      :payload,
      :payment_intent_id,
      :received_at
    ])
    |> validate_required([:provider, :external_id, :event_type, :payload])
    |> put_received_at()
    |> unique_constraint(:external_id,
      name: :webhook_events_provider_external_id_index,
      message: "has already been received"
    )
  end

  @doc "Acted on successfully."
  def processed_changeset(event, intent_id \\ nil) do
    change(event, %{
      status: "processed",
      processed_at: DateTime.utc_now(),
      attempts: event.attempts + 1,
      payment_intent_id: intent_id || event.payment_intent_id
    })
  end

  @doc """
  Nothing to do with us.

  Providers send a great deal a POS does not care about, and treating "we do
  not handle this" as a failure fills the retry queue with noise nobody will
  ever look at.
  """
  def ignored_changeset(event),
    do: change(event, status: "ignored", processed_at: DateTime.utc_now())

  @doc "Failed to process. Kept for a retry, with the reason on it."
  def failed_changeset(event, reason) do
    change(event, %{
      status: "failed",
      attempts: event.attempts + 1,
      last_error: to_string(reason)
    })
  end

  @doc "True when this event still needs acting on."
  @spec pending?(t()) :: boolean()
  def pending?(%__MODULE__{status: status}), do: status in ["received", "failed"]

  defp put_received_at(changeset) do
    case get_field(changeset, :received_at) do
      nil -> put_change(changeset, :received_at, DateTime.utc_now())
      _set -> changeset
    end
  end
end
