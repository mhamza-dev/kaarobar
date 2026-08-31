defmodule Kaarobar.Billing.Subscription do
  @moduledoc """
  What one organization is paying for, and until when.

  ## A failed card does not close a shop

  `past_due` is not the end of access — `grace_until` is. A card expires on a
  Sunday, a bank declines a foreign charge, a finance team is on leave: none of
  those are reasons for a shop to be unable to sell on Monday morning, and a
  system that treats them that way loses the customer over an amount they were
  always going to pay.

  So access survives the first decline and ends at a date the customer has been
  told about, which is what the dunning schedule counts down to.

  ## Cancelling takes effect when the paid period ends

  `cancel_at_period_end` is the ordinary case. Ending it the instant somebody
  clicks cancel would be taking a month's money and withdrawing the service in
  the same act. Immediate termination exists, but it is a separate decision.
  """

  use Kaarobar.Schema

  alias Kaarobar.Billing.Plan
  alias Kaarobar.Billing.SubscriptionItem
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(trialing active past_due paused canceled expired)
  @providers ~w(manual stripe)
  # The statuses that still let an organization work.
  @serviceable ~w(trialing active past_due)
  # How long a shop keeps working after a payment fails. Long enough to reach a
  # human who can put a new card in, short enough not to be a free month.
  @grace_days 14

  schema "subscriptions" do
    field :status, :string, default: "trialing"
    field :provider, :string, default: "manual"
    field :currency, :string, default: "PKR"

    field :current_period_start, :utc_datetime_usec
    field :current_period_end, :utc_datetime_usec
    field :trial_ends_at, :utc_datetime_usec
    field :grace_until, :utc_datetime_usec

    field :cancel_at_period_end, :boolean, default: false
    field :canceled_at, :utc_datetime_usec
    field :ended_at, :utc_datetime_usec

    field :external_customer_id, :string
    field :external_subscription_id, :string

    belongs_to :organization, Organization
    belongs_to :plan, Plan

    has_many :items, SubscriptionItem

    timestamps()
  end

  @doc "Every state a subscription may be in."
  def statuses, do: @statuses

  @doc "Who is collecting the money."
  def providers, do: @providers

  @doc "The states in which an organization may still use the platform."
  def serviceable_statuses, do: @serviceable

  @doc "How many days of access a failed payment buys."
  def grace_days, do: @grace_days

  def changeset(subscription, attrs) do
    subscription
    |> cast(attrs, [
      :organization_id,
      :plan_id,
      :status,
      :provider,
      :currency,
      :current_period_start,
      :current_period_end,
      :trial_ends_at,
      :cancel_at_period_end,
      :external_customer_id,
      :external_subscription_id
    ])
    |> validate_required([:organization_id, :plan_id, :status, :currency])
    |> validate_inclusion(:status, @statuses)
    |> validate_inclusion(:provider, @providers)
    |> unique_constraint(:organization_id,
      name: :subscriptions_active_organization_index,
      message: "already has a subscription"
    )
    |> unique_constraint(:external_subscription_id,
      name: :subscriptions_external_subscription_id_index,
      message: "is already linked to another subscription"
    )
    |> foreign_key_constraint(:plan_id)
  end

  @doc "Moves the subscription into its next paid period."
  def renew_changeset(subscription, %DateTime{} = from, %DateTime{} = until) do
    change(subscription, %{
      status: "active",
      current_period_start: from,
      current_period_end: until,
      grace_until: nil
    })
  end

  @doc """
  Records a failed payment.

  Sets the date access actually ends, once, and leaves it alone on later
  failures. Extending the grace with every decline would make a subscription
  that never pays and never stops.
  """
  def past_due_changeset(subscription) do
    grace = subscription.grace_until || DateTime.add(DateTime.utc_now(), @grace_days, :day)

    change(subscription, %{status: "past_due", grace_until: grace})
  end

  @doc "Asks for the subscription to end when the paid period does."
  def cancel_at_period_end_changeset(subscription) do
    change(subscription, %{cancel_at_period_end: true, canceled_at: DateTime.utc_now()})
  end

  @doc """
  Ends it now.

  Separate from the ordinary cancel, and rarer: the customer keeps what they
  paid for unless they have explicitly asked not to.
  """
  def end_changeset(subscription, status \\ "canceled") do
    change(subscription, %{
      status: status,
      canceled_at: subscription.canceled_at || DateTime.utc_now(),
      ended_at: DateTime.utc_now(),
      grace_until: nil
    })
  end

  @doc "Puts a paused subscription back to work."
  def resume_changeset(subscription),
    do: change(subscription, status: "active", cancel_at_period_end: false, canceled_at: nil)

  @doc """
  True when this subscription still entitles the organization to work.

  A `past_due` one does, until its grace runs out. That is the whole point of
  the grace: the shop keeps selling while somebody sorts the card out.
  """
  @spec serviceable?(t() | nil, DateTime.t()) :: boolean()
  def serviceable?(subscription, now \\ DateTime.utc_now())

  def serviceable?(nil, _now), do: false

  def serviceable?(%__MODULE__{status: "past_due"} = subscription, now) do
    case subscription.grace_until do
      nil -> true
      grace -> DateTime.compare(now, grace) != :gt
    end
  end

  def serviceable?(%__MODULE__{status: status}, _now), do: status in @serviceable

  @doc "True while the organization is inside its free trial."
  @spec trialing?(t(), DateTime.t()) :: boolean()
  def trialing?(subscription, now \\ DateTime.utc_now())

  def trialing?(%__MODULE__{status: "trialing", trial_ends_at: nil}, _now), do: true

  def trialing?(%__MODULE__{status: "trialing", trial_ends_at: ends_at}, now),
    do: DateTime.compare(now, ends_at) != :gt

  def trialing?(%__MODULE__{}, _now), do: false

  @doc "Days left before access stops, or nil when nothing is running out."
  @spec days_remaining(t(), DateTime.t()) :: integer() | nil
  def days_remaining(subscription, now \\ DateTime.utc_now())

  def days_remaining(%__MODULE__{status: "trialing", trial_ends_at: ends_at}, now)
      when not is_nil(ends_at),
      do: days_between(now, ends_at)

  def days_remaining(%__MODULE__{status: "past_due", grace_until: grace}, now)
      when not is_nil(grace),
      do: days_between(now, grace)

  def days_remaining(%__MODULE__{}, _now), do: nil

  defp days_between(now, until), do: DateTime.diff(until, now, :day)
end
