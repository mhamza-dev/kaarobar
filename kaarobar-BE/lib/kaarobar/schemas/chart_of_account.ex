defmodule Kaarobar.Schemas.ChartOfAccount do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "chart_of_accounts" do
    field :code, :string
    field :name, :string
    field :type, :string

    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :parent_account, Kaarobar.Schemas.ChartOfAccount

    timestamps(type: :utc_datetime)
  end

  def changeset(account, attrs) do
    account
    |> cast(attrs, [:code, :name, :type, :business_id, :owner_id, :parent_account_id])
    |> validate_required([:code, :name, :type, :business_id, :owner_id])
    |> validate_inclusion(:type, ["Asset", "Liability", "Equity", "Revenue", "Expense"])
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:owner_id)
    |> unique_constraint([:business_id, :code])
  end
end
