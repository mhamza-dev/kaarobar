defmodule Kaarobar.Taxes.TaxGroupRate do
  @moduledoc """
  One rate's membership of a group.

  `position` matters as soon as a compound rate is involved: a rate charged on
  the running total gives a different answer depending on what came before it.
  """

  use Kaarobar.Schema

  alias Kaarobar.Taxes.Tax
  alias Kaarobar.Taxes.TaxGroup

  schema "tax_group_rates" do
    field :position, :integer, default: 0

    belongs_to :tax_group, TaxGroup
    belongs_to :tax, Tax

    timestamps(updated_at: false)
  end

  def changeset(group_rate, attrs) do
    group_rate
    |> cast(attrs, [:tax_group_id, :tax_id, :position])
    |> validate_required([:tax_group_id, :tax_id])
    |> validate_number(:position, greater_than_or_equal_to: 0)
    |> foreign_key_constraint(:tax_group_id)
    |> foreign_key_constraint(:tax_id)
    |> unique_constraint([:tax_group_id, :tax_id],
      message: "is already in this tax group"
    )
  end
end
