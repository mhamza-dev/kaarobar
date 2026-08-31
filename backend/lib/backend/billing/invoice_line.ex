defmodule Kaarobar.Billing.InvoiceLine do
  @moduledoc """
  One line of a platform invoice.

  The description is written out in full rather than joined to a plan, for the
  same reason a sale line snapshots its product name: an invoice from March has
  to keep saying what it said in March, even after the plan it billed for was
  renamed or withdrawn.
  """

  use Kaarobar.Schema

  alias Kaarobar.Billing.Invoice
  alias Kaarobar.Money

  schema "platform_invoice_lines" do
    field :description, :string
    field :quantity, :integer, default: 1
    field :unit_amount, :decimal, default: Decimal.new(0)
    field :amount, :decimal, default: Decimal.new(0)
    field :position, :integer, default: 0

    belongs_to :invoice, Invoice

    timestamps()
  end

  def changeset(line, attrs) do
    line
    |> cast(attrs, [:invoice_id, :description, :quantity, :unit_amount, :amount, :position])
    |> validate_required([:description, :quantity, :unit_amount])
    |> validate_number(:quantity, greater_than_or_equal_to: 0)
    |> put_amount()
    |> foreign_key_constraint(:invoice_id)
  end

  # Computed rather than accepted. A caller that could send its own line total
  # could send one that does not match the quantity and price beside it, and
  # the invoice would be internally inconsistent from the day it was issued.
  defp put_amount(changeset) do
    quantity = get_field(changeset, :quantity) || 0
    unit = get_field(changeset, :unit_amount) || Money.zero()

    put_change(changeset, :amount, Money.round_working(Money.mult(unit, quantity)))
  end
end
