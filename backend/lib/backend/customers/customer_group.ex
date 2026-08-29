defmodule Kaarobar.Customers.CustomerGroup do
  @moduledoc """
  A class of customer who buys on different terms.

  Trade buyers at an agri-chemical depot, a salon's package holders, a
  restaurant's staff. Every business in the catalogue ends up with a second
  price for someone, and the alternative — a discount typed at the till — loses
  the reason it was given and lets any cashier grant it.

  A group carries the price list, the standing discount, the credit terms and
  the limit, so the decision is made once by the owner instead of hourly at the
  counter.
  """

  use Kaarobar.Schema

  alias Kaarobar.Customers.Customer
  alias Kaarobar.Money
  alias Kaarobar.Pricing.PriceList
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  schema "customer_groups" do
    field :name, :string
    field :code, :string
    field :description, :string

    field :discount_percent, :decimal
    field :payment_terms_days, :integer, default: 0
    field :credit_limit, :decimal
    field :credit_allowed, :boolean, default: false
    field :loyalty_multiplier, :decimal, default: Decimal.new(1)

    field :is_default, :boolean, default: false
    field :is_active, :boolean, default: true
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :price_list, PriceList

    has_many :customers, Customer

    timestamps()
  end

  def changeset(group, attrs) do
    group
    |> cast(attrs, [
      :name,
      :code,
      :description,
      :price_list_id,
      :discount_percent,
      :payment_terms_days,
      :credit_limit,
      :credit_allowed,
      :loyalty_multiplier,
      :is_default,
      :is_active
    ])
    |> validate_required([:name])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 80)
    |> validate_number(:discount_percent,
      greater_than_or_equal_to: 0,
      less_than_or_equal_to: 1
    )
    |> validate_number(:payment_terms_days, greater_than_or_equal_to: 0)
    |> validate_number(:credit_limit, greater_than_or_equal_to: 0)
    |> validate_number(:loyalty_multiplier, greater_than_or_equal_to: 0)
    |> unique_constraint(:name,
      name: :customer_groups_business_id_name_index,
      message: "is already used by another group"
    )
    |> unique_constraint(:code,
      name: :customer_groups_business_id_code_index,
      message: "is already used by another group"
    )
    |> unique_constraint(:is_default,
      name: :customer_groups_single_default_index,
      message: "another group is already the default"
    )
    |> foreign_key_constraint(:price_list_id)
  end

  @doc "Soft-deletes the group. Members keep their own terms."
  def soft_delete_changeset(group), do: change(group, deleted_at: DateTime.utc_now())

  @doc """
  The discount this group grants on an amount.

  Zero when no standing discount is set, so callers need no special case.
  """
  @spec discount_on(t() | nil, Decimal.t()) :: Decimal.t()
  def discount_on(nil, _amount), do: Money.zero()
  def discount_on(%__MODULE__{discount_percent: nil}, _amount), do: Money.zero()

  def discount_on(%__MODULE__{discount_percent: percent}, amount),
    do: amount |> Money.rate_of(percent) |> Money.round()

  @doc "How many points a spend earns here, relative to the programme's rate."
  @spec loyalty_multiplier(t() | nil) :: Decimal.t()
  def loyalty_multiplier(nil), do: Decimal.new(1)
  def loyalty_multiplier(%__MODULE__{loyalty_multiplier: nil}), do: Decimal.new(1)
  def loyalty_multiplier(%__MODULE__{loyalty_multiplier: value}), do: value
end
