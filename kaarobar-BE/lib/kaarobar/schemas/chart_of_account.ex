defmodule Kaarobar.Schemas.ChartOfAccount do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @types ~w(Asset Liability Equity Revenue Expense)
  @normal_balances ~w(debit credit)
  @classifications ~w(
    current_asset non_current_asset
    current_liability non_current_liability
    equity
    revenue cost_of_sales operating_expense other_income other_expense
  )

  schema "chart_of_accounts" do
    field :code, :string
    field :name, :string
    field :type, :string
    field :normal_balance, :string, default: "debit"
    field :classification, :string
    field :is_header, :boolean, default: false

    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :parent_account, Kaarobar.Schemas.ChartOfAccount

    timestamps(type: :utc_datetime)
  end

  def changeset(account, attrs) do
    account
    |> cast(attrs, [
      :code,
      :name,
      :type,
      :business_id,
      :owner_id,
      :parent_account_id,
      :normal_balance,
      :classification,
      :is_header
    ])
    |> validate_required([:code, :name, :type, :business_id, :owner_id])
    |> update_change(:code, &normalize_code/1)
    |> maybe_default_normal_balance()
    |> maybe_default_classification()
    |> validate_inclusion(:type, @types)
    |> validate_inclusion(:normal_balance, @normal_balances)
    |> validate_inclusion(:classification, @classifications)
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:owner_id)
    |> foreign_key_constraint(:parent_account_id)
    |> unique_constraint([:business_id, :code])
  end

  defp normalize_code(nil), do: nil

  defp normalize_code(code) when is_binary(code) do
    code |> String.trim() |> String.upcase()
  end

  defp maybe_default_normal_balance(changeset) do
    case get_field(changeset, :normal_balance) do
      nil ->
        type = get_field(changeset, :type)
        put_change(changeset, :normal_balance, default_normal_balance(type))

      _ ->
        changeset
    end
  end

  defp maybe_default_classification(changeset) do
    case get_field(changeset, :classification) do
      nil ->
        type = get_field(changeset, :type)
        put_change(changeset, :classification, default_classification(type))

      _ ->
        changeset
    end
  end

  def default_normal_balance("Asset"), do: "debit"
  def default_normal_balance("Expense"), do: "debit"
  def default_normal_balance("Liability"), do: "credit"
  def default_normal_balance("Equity"), do: "credit"
  def default_normal_balance("Revenue"), do: "credit"
  def default_normal_balance(_), do: "debit"

  def default_classification("Asset"), do: "current_asset"
  def default_classification("Liability"), do: "current_liability"
  def default_classification("Equity"), do: "equity"
  def default_classification("Revenue"), do: "revenue"
  def default_classification("Expense"), do: "operating_expense"
  def default_classification(_), do: "operating_expense"
end
