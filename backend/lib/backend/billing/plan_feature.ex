defmodule Kaarobar.Billing.PlanFeature do
  @moduledoc """
  One thing a plan includes: a module it unlocks, or a limit it imposes.

  A row rather than a column, so adding a feature to a plan is data and not a
  migration. Pricing changes far more often than schemas should.

  ## Null is unlimited, and zero is not

  `limit_value` left null means the plan does not cap that thing. Reading an
  absent limit as zero would turn "no stated branch limit" into "no branches
  allowed", which is the sort of default that takes a paying customer's shop
  offline at midnight.
  """

  use Kaarobar.Schema

  alias Kaarobar.Billing.Plan

  schema "plan_features" do
    field :key, :string
    field :is_enabled, :boolean, default: true
    field :limit_value, :integer

    belongs_to :plan, Plan

    timestamps()
  end

  def changeset(feature, attrs) do
    feature
    |> cast(attrs, [:plan_id, :key, :is_enabled, :limit_value])
    |> validate_required([:key])
    |> validate_number(:limit_value, greater_than_or_equal_to: 0)
    |> unique_constraint(:key,
      name: :plan_features_plan_id_key_index,
      message: "is already set on this plan"
    )
    |> foreign_key_constraint(:plan_id)
  end

  @doc """
  The limit this feature imposes, or `:unlimited`.

  Returned as an atom rather than `nil` so a caller cannot accidentally compare
  a count against nothing and conclude the limit was met.
  """
  @spec limit(t()) :: non_neg_integer() | :unlimited
  def limit(%__MODULE__{limit_value: nil}), do: :unlimited
  def limit(%__MODULE__{limit_value: value}), do: value
end
