defmodule Kaarobar.Finance.Category do
  @moduledoc """
  What a spend is for: rent, wages, electricity, stock.

  ## `kind` is what keeps a P&L honest

  A category sits above or below the gross-profit line, and getting that wrong
  makes margin meaningless. Stock bought for resale is cost of sales; the
  electricity bill is an operating cost. Filing both together and subtracting
  the lot from revenue would count the stock twice — once through the cost
  snapshot on every sale line, and again as an expense.
  """

  use Kaarobar.Schema

  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @kinds ~w(operating cost_of_sales payroll tax other)

  schema "expense_categories" do
    field :name, :string
    field :code, :string
    field :kind, :string, default: "operating"

    field :is_active, :boolean, default: true
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business

    timestamps()
  end

  @doc "Where each kind of spend sits in the accounts."
  def kinds, do: @kinds

  def changeset(category, attrs) do
    category
    |> cast(attrs, [:organization_id, :business_id, :name, :code, :kind, :is_active])
    |> validate_required([:organization_id, :business_id, :name])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 80)
    |> validate_inclusion(:kind, @kinds)
    |> unique_constraint(:name,
      name: :expense_categories_business_id_name_index,
      message: "is already used by another category"
    )
  end

  @doc "Soft-deletes the category. Expenses already filed under it keep it."
  def soft_delete_changeset(category), do: change(category, deleted_at: DateTime.utc_now())

  @doc """
  True when this spend is already counted through the cost of what was sold.

  Cost of sales reaches the P&L through each sale line's cost snapshot, so
  subtracting these expenses as well would take the same money off twice.
  """
  @spec counted_in_cost_of_sales?(t()) :: boolean()
  def counted_in_cost_of_sales?(%__MODULE__{kind: "cost_of_sales"}), do: true
  def counted_in_cost_of_sales?(%__MODULE__{}), do: false
end
