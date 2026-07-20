defmodule Kaarobar.PayrollDeductions do
  @moduledoc """
  Statutory deduction engine (HR-FR-008).

  Pakistan income tax uses progressive monthly slabs (simplified salaried schedule).
  EOBI employee share defaults to 1% of basic, floored at Rs 100.
  """

  @eobi_rate Decimal.new("0.01")
  @eobi_floor Decimal.new("100.00")

  # Monthly taxable income slabs: {upper_bound_or_nil, base_tax, marginal_rate, excess_over}
  @tax_slabs [
    {Decimal.new("60000"), Decimal.new("0"), Decimal.new("0"), Decimal.new("0")},
    {Decimal.new("120000"), Decimal.new("0"), Decimal.new("0.05"), Decimal.new("60000")},
    {Decimal.new("240000"), Decimal.new("3000"), Decimal.new("0.10"), Decimal.new("120000")},
    {Decimal.new("360000"), Decimal.new("15000"), Decimal.new("0.15"), Decimal.new("240000")},
    {Decimal.new("600000"), Decimal.new("33000"), Decimal.new("0.20"), Decimal.new("360000")},
    {Decimal.new("1200000"), Decimal.new("81000"), Decimal.new("0.25"), Decimal.new("600000")},
    {nil, Decimal.new("231000"), Decimal.new("0.30"), Decimal.new("1200000")}
  ]

  def compute(gross, basic) do
    eobi = eobi_employee(basic)
    taxable = Decimal.sub(gross, eobi) |> Decimal.max(Decimal.new(0))
    tax = income_tax(taxable)

    %{
      income_tax: Decimal.round(tax, 2),
      eobi: Decimal.round(eobi, 2),
      total: Decimal.add(tax, eobi) |> Decimal.round(2)
    }
  end

  def eobi_employee(basic) do
    pct = Decimal.mult(to_dec(basic), @eobi_rate) |> Decimal.round(2)

    if Decimal.compare(pct, @eobi_floor) == :lt do
      @eobi_floor
    else
      pct
    end
  end

  def income_tax(monthly_taxable) do
    income = to_dec(monthly_taxable)

    Enum.reduce_while(@tax_slabs, Decimal.new(0), fn {upper, base, rate, excess_over}, _acc ->
      in_band? =
        is_nil(upper) or Decimal.compare(income, upper) != :gt

      if in_band? do
        excess = Decimal.sub(income, excess_over) |> Decimal.max(Decimal.new(0))
        tax = Decimal.add(base, Decimal.mult(excess, rate))
        {:halt, tax}
      else
        {:cont, Decimal.new(0)}
      end
    end)
  end

  defp to_dec(%Decimal{} = d), do: d
  defp to_dec(v), do: Decimal.new("#{v}")
end
