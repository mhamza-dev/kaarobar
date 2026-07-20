defmodule Kaarobar.Schemas.Business do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

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

    timestamps(type: :utc_datetime)
  end

  def changeset(business, attrs) do
    business
    |> cast(attrs, [:name, :industry, :tax_jurisdiction, :subscription_plan, :fbr_tier1, :is_active, :owner_id])
    |> validate_required([:name, :owner_id])
    |> foreign_key_constraint(:owner_id)
  end
end
