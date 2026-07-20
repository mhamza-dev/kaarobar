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

    belongs_to :owner, Kaarobar.Schemas.User
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
      :owner_id
    ])
    |> validate_required([:name, :owner_id])
    |> maybe_validate_industry()
    |> foreign_key_constraint(:owner_id)
  end

  defp maybe_validate_industry(changeset) do
    case get_field(changeset, :industry) do
      nil -> changeset
      "" -> put_change(changeset, :industry, nil)
      _ -> validate_inclusion(changeset, :industry, @industries)
    end
  end
end
