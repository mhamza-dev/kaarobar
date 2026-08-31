defmodule Kaarobar.Billing.Plan do
  @moduledoc """
  What Kaarobar sells: a named bundle of features at a price.

  Platform-owned, so it carries no tenant. A per-organization copy of the
  catalogue would drift the first time a plan changed, leaving two shops on
  "Standard" with different features and nobody able to say which was right.

  ## Retiring a plan does not move the shops on it

  `is_public` hides a plan from the pricing page while leaving it live, which
  is how an old price is honoured for the customers already paying it. Only
  `is_active` — and a soft delete — take it out of service, and neither
  migrates anybody: what a customer is charged does not change because we
  changed our minds about what to offer next.
  """

  use Kaarobar.Schema

  alias Kaarobar.Billing.PlanFeature
  alias Kaarobar.Money

  @intervals ~w(month year)

  schema "subscription_plans" do
    field :code, :string
    field :name, :string
    field :description, :string

    field :interval, :string, default: "month"
    field :currency, :string, default: "PKR"
    field :amount, :decimal, default: Decimal.new(0)

    field :trial_days, :integer, default: 0

    field :is_public, :boolean, default: true
    field :is_active, :boolean, default: true
    field :position, :integer, default: 0

    field :external_price_id, :string
    field :deleted_at, :utc_datetime_usec

    has_many :features, PlanFeature, foreign_key: :plan_id

    timestamps()
  end

  @doc "How often a plan bills."
  def intervals, do: @intervals

  def changeset(plan, attrs) do
    plan
    |> cast(attrs, [
      :code,
      :name,
      :description,
      :interval,
      :currency,
      :amount,
      :trial_days,
      :is_public,
      :is_active,
      :position,
      :external_price_id
    ])
    |> validate_required([:code, :name, :interval, :currency, :amount])
    |> validate_inclusion(:interval, @intervals)
    |> validate_number(:amount, greater_than_or_equal_to: 0)
    |> validate_number(:trial_days, greater_than_or_equal_to: 0)
    |> validate_format(:code, ~r/^[a-z0-9_-]+$/,
      message: "may only contain lowercase letters, numbers, hyphens and underscores"
    )
    |> unique_constraint(:code,
      name: :subscription_plans_code_index,
      message: "is already used by another plan"
    )
  end

  @doc "Soft-deletes a plan. Subscriptions already on it keep working."
  def soft_delete_changeset(plan), do: change(plan, deleted_at: DateTime.utc_now())

  @doc "True when a new subscription may be started on this plan."
  @spec available?(t()) :: boolean()
  def available?(%__MODULE__{deleted_at: nil, is_active: true}), do: true
  def available?(%__MODULE__{}), do: false

  @doc "True when the plan should appear on the pricing page."
  @spec listed?(t()) :: boolean()
  def listed?(%__MODULE__{} = plan), do: available?(plan) and plan.is_public

  @doc "True when this plan is given away."
  @spec free?(t()) :: boolean()
  def free?(%__MODULE__{amount: amount}), do: Money.zero?(amount)

  @doc """
  When a period starting now would end.

  Months are added by calendar rather than by 30 days, so a shop that signs up
  on the 3rd is always billed on the 3rd.
  """
  @spec period_end(t(), DateTime.t()) :: DateTime.t()
  def period_end(%__MODULE__{interval: "year"}, from), do: shift_months(from, 12)
  def period_end(%__MODULE__{}, from), do: shift_months(from, 1)

  # A subscription started on the 31st has to bill in February. Clamping to the
  # last day of the target month is what every billing system settles on, and
  # it is what the customer expects: nobody signs up on the 31st of January
  # expecting to be skipped in February.
  defp shift_months(%DateTime{} = from, months) do
    date = DateTime.to_date(from)
    total = date.year * 12 + (date.month - 1) + months
    year = div(total, 12)
    month = rem(total, 12) + 1
    day = min(date.day, Date.days_in_month(%Date{year: year, month: month, day: 1}))

    %{from | year: year, month: month, day: day}
  end
end
