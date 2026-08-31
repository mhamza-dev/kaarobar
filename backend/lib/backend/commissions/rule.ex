defmodule Kaarobar.Commissions.Rule do
  @moduledoc """
  What a member of staff earns on what they sell.

  ## Narrower rules win

  A rule naming one stylist and one service beats one naming that stylist,
  which beats the shop-wide default. `priority` breaks ties, but the
  specificity ordering is what a shop actually reasons in — "Ayesha gets 40% on
  colours, 25% on everything else" is two rules, and neither needs to know
  about the other.

  ## Three bases, because shops pay three ways

  `percent_of_net` is the common one. `percent_of_margin` is what a shop uses
  when staff can discount — paying on revenue makes a discount free to the
  person granting it. `flat_per_item` is for piecework.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Catalog.Category
  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Money
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @bases ~w(percent_of_net percent_of_margin flat_per_item)

  schema "commission_rules" do
    field :name, :string
    field :basis, :string, default: "percent_of_net"
    field :rate, :decimal
    field :flat_amount, :decimal
    field :min_sales_amount, :decimal

    field :priority, :integer, default: 100
    field :is_active, :boolean, default: true
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :user, User
    belongs_to :variant, ProductVariant
    belongs_to :category, Category

    timestamps()
  end

  @doc "The ways commission can be worked out."
  def bases, do: @bases

  def changeset(rule, attrs) do
    rule
    |> cast(attrs, [
      :name,
      :user_id,
      :variant_id,
      :category_id,
      :basis,
      :rate,
      :flat_amount,
      :min_sales_amount,
      :priority,
      :is_active
    ])
    |> validate_required([:name, :basis])
    |> validate_inclusion(:basis, @bases)
    |> validate_number(:rate, greater_than_or_equal_to: 0, less_than_or_equal_to: 1)
    |> validate_number(:flat_amount, greater_than_or_equal_to: 0)
    |> validate_amount_present()
  end

  @doc "Soft-deletes the rule. Commission already accrued keeps its own rate."
  def soft_delete_changeset(rule), do: change(rule, deleted_at: DateTime.utc_now())

  @doc """
  How specific this rule is: higher wins.

  A rule naming a person and a service is more specific than one naming only
  the person, and a shop reasons about its pay structure exactly this way.
  """
  @spec specificity(t()) :: non_neg_integer()
  def specificity(%__MODULE__{} = rule) do
    [rule.user_id, rule.variant_id, rule.category_id]
    |> Enum.count(&(not is_nil(&1)))
  end

  @doc """
  True when this rule could apply to a line sold by this person.

  A rule with a null field is a wildcard on it — that is what makes a shop-wide
  default expressible as an ordinary rule rather than a special case.
  """
  @spec matches?(t(), map()) :: boolean()
  def matches?(%__MODULE__{} = rule, line) do
    field_matches?(rule.user_id, Map.get(line, :user_id)) and
      field_matches?(rule.variant_id, Map.get(line, :variant_id)) and
      field_matches?(rule.category_id, Map.get(line, :category_id))
  end

  @doc """
  What this rule pays on a line.

  `net` is the line after discount; `margin` is that less what it cost. A shop
  paying on margin is one whose staff can discount, and paying on revenue there
  makes the discount free to the person granting it.
  """
  @spec amount_for(t(), %{net: Decimal.t(), margin: Decimal.t(), quantity: Decimal.t()}) ::
          {Decimal.t(), Decimal.t()}
  def amount_for(%__MODULE__{basis: "flat_per_item"} = rule, line) do
    base = line.quantity
    {base, base |> Money.mult(rule.flat_amount || Money.zero()) |> Money.round()}
  end

  def amount_for(%__MODULE__{basis: "percent_of_margin"} = rule, line) do
    base = Money.clamp_non_negative(line.margin)
    {base, base |> Money.rate_of(rule.rate || Money.zero()) |> Money.round()}
  end

  def amount_for(%__MODULE__{} = rule, line) do
    base = Money.clamp_non_negative(line.net)
    {base, base |> Money.rate_of(rule.rate || Money.zero()) |> Money.round()}
  end

  defp field_matches?(nil, _value), do: true
  defp field_matches?(rule_value, value), do: rule_value == value

  # A rule with neither a rate nor a flat amount pays nothing, and reads as
  # though it pays something.
  defp validate_amount_present(changeset) do
    rate = get_field(changeset, :rate)
    flat = get_field(changeset, :flat_amount)

    if is_nil(rate) and is_nil(flat) do
      add_error(changeset, :rate, "or a flat amount is required")
    else
      changeset
    end
  end
end
