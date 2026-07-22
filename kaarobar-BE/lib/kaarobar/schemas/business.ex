defmodule Kaarobar.Schemas.Business do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @industries ~w(retail restaurant salon pharmacy supermarket wholesale general)

  schema "businesses" do
    field :name, :string
    field :industry, :string
    field :tax_jurisdiction, :string, default: "PK"
    field :subscription_plan, :string, default: "trial"
    field :fbr_tier1, :boolean, default: false
    field :is_active, :boolean, default: true
    field :loyalty_earn_per_amount, :decimal, default: Decimal.new("100")
    field :loyalty_points_per_earn, :integer, default: 1
    field :loyalty_redeem_value, :decimal, default: Decimal.new("1.00")
    field :portal_self_register, :boolean, default: false
    field :portal_invite_from_sale, :boolean, default: true
    field :marketplace_enabled, :boolean, default: false
    field :marketplace_slug, :string
    field :messaging_wallet_balance, :decimal, default: Decimal.new("0")

    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :online_branch, Kaarobar.Schemas.Branch
    has_many :branches, Kaarobar.Schemas.Branch
    has_many :products, Kaarobar.Schemas.Product
    has_many :chart_of_accounts, Kaarobar.Schemas.ChartOfAccount
    has_many :product_categories, Kaarobar.Schemas.ProductCategory

    timestamps(type: :utc_datetime)
  end

  def industries, do: @industries

  def changeset(business, attrs) do
    business
    |> cast(attrs, [
      :name,
      :industry,
      :tax_jurisdiction,
      :subscription_plan,
      :fbr_tier1,
      :is_active,
      :loyalty_earn_per_amount,
      :loyalty_points_per_earn,
      :loyalty_redeem_value,
      :portal_self_register,
      :portal_invite_from_sale,
      :marketplace_enabled,
      :marketplace_slug,
      :messaging_wallet_balance,
      :online_branch_id,
      :owner_id
    ])
    |> update_change(:marketplace_slug, &blank_to_nil/1)
    |> validate_required([:name, :owner_id])
    |> maybe_validate_industry()
    |> validate_number(:loyalty_earn_per_amount, greater_than: 0)
    |> validate_number(:loyalty_points_per_earn, greater_than: 0)
    |> validate_number(:loyalty_redeem_value, greater_than: 0)
    |> foreign_key_constraint(:owner_id)
    |> foreign_key_constraint(:online_branch_id)
    |> unique_constraint(:marketplace_slug, name: :businesses_marketplace_slug_uidx)
  end

  defp blank_to_nil(nil), do: nil
  defp blank_to_nil(""), do: nil
  defp blank_to_nil(v) when is_binary(v) do
    s = String.trim(v)
    if s == "", do: nil, else: String.downcase(s)
  end
  defp blank_to_nil(v), do: v

  defp maybe_validate_industry(changeset) do
    case get_field(changeset, :industry) do
      nil -> changeset
      "" -> put_change(changeset, :industry, nil)
      _ -> validate_inclusion(changeset, :industry, @industries)
    end
  end
end
