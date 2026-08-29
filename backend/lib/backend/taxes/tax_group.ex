defmodule Kaarobar.Taxes.TaxGroup do
  @moduledoc """
  A named bundle of tax rates that products are assigned to.

  Products point here rather than at rates directly, so a rate change is one
  row rather than a bulk update of the catalog. A jurisdiction that charges two
  taxes on the same item is one group holding two rates.

  `is_exempt` is distinct from having no group. "Exempt" is a decision that
  prints on the invoice; "no group" means nobody has decided yet, and the two
  should not look the same to an auditor.
  """

  use Kaarobar.Schema

  alias Kaarobar.Taxes.TaxGroupRate
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  schema "tax_groups" do
    field :name, :string
    field :code, :string
    field :is_default, :boolean, default: false
    field :is_exempt, :boolean, default: false
    field :is_active, :boolean, default: true
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business

    has_many :tax_group_rates, TaxGroupRate
    has_many :taxes, through: [:tax_group_rates, :tax]

    timestamps()
  end

  def changeset(group, attrs) do
    group
    |> cast(attrs, [:name, :code, :is_exempt, :is_active])
    |> validate_required([:name])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 80)
    |> unique_constraint(:code,
      name: :tax_groups_business_id_code_index,
      message: "is already used by another tax group"
    )
    |> unique_constraint(:is_default,
      name: :tax_groups_single_default_index,
      message: "another tax group is already the default"
    )
  end

  @doc """
  Changeset for making this the default group.

  Promoting one demotes the other, which has to happen in the same transaction
  — the database permits only one default per business.
  """
  def default_changeset(group, is_default) when is_boolean(is_default) do
    group
    |> change(is_default: is_default)
    |> unique_constraint(:is_default,
      name: :tax_groups_single_default_index,
      message: "another tax group is already the default"
    )
  end

  @doc "Soft-deletes the group."
  def soft_delete_changeset(group), do: change(group, deleted_at: DateTime.utc_now())

  @doc "The rates in this group, in application order, when loaded."
  @spec ordered_taxes(t()) :: [Kaarobar.Taxes.Tax.t()]
  def ordered_taxes(%__MODULE__{tax_group_rates: rates}) when is_list(rates) do
    rates
    |> Enum.sort_by(& &1.position)
    |> Enum.map(& &1.tax)
    |> Enum.filter(&match?(%Kaarobar.Taxes.Tax{}, &1))
  end

  def ordered_taxes(%__MODULE__{}), do: []
end
