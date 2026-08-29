defmodule Kaarobar.Taxes.Calculation do
  @moduledoc """
  Turns an amount and a tax group into a net figure, a gross figure, and the
  itemised lines that go on the invoice.

  ## The two directions

  A shop either quotes prices **exclusive** of tax and adds it at the till, or
  quotes them **inclusive** and has to work backwards to find the net. Both are
  common — a wholesaler does the first, a café doing 250-rupee lunches does the
  second — and `Kaarobar.Tenancy.Business.prices_include_tax` says which.

  Forward is arithmetic. Backwards is the interesting direction: given a gross
  of 250 and a 17% tax, the net is not 250 minus 17% (which would be 207.50),
  it is 250 ÷ 1.17 (213.68). The difference is 6 rupees a line, on every line,
  and getting it wrong is the single most common tax bug in point-of-sale
  software.

  ## Compound rates

  A compound rate is charged on the running total including the rates before
  it, rather than on the net. 5% then a compound 3% on 100 is not 108, it is
  108.15. Both arrangements exist in real jurisdictions, so `position` on
  `tax_group_rates` fixes the order and `is_compound` fixes the base.

  To invert a mixture of compound and simple rates, the net is not derived
  algebraically — it is found by running the forward calculation on a net of
  one to obtain the effective multiplier, then dividing. That handles any
  combination without a special case per shape, and stays correct if a
  jurisdiction invents a stranger one.

  ## Fixed rates

  A fixed tax adds a constant rather than a proportion — a per-unit levy. It is
  removed before the division and added back afterwards, since a constant does
  not scale with the net.

  ## Rounding

  Every line is rounded to the currency's minor units, and the total is the sum
  of the rounded lines rather than the rounding of the total. Otherwise the
  printed lines do not add up to the printed total, which is the first thing an
  auditor checks.
  """

  alias Kaarobar.Money
  alias Kaarobar.Taxes.Tax

  @type line :: %{
          tax_id: Ecto.UUID.t() | nil,
          name: String.t(),
          label: String.t(),
          rate: Decimal.t(),
          kind: String.t(),
          compound: boolean(),
          amount: Decimal.t()
        }

  @type result :: %{
          net: Decimal.t(),
          tax_total: Decimal.t(),
          gross: Decimal.t(),
          lines: [line()],
          inclusive: boolean()
        }

  @doc """
  Computes tax for an amount against an ordered list of rates.

  ## Options

    * `:inclusive` — the amount already contains tax. Defaults to `false`.
    * `:currency` — decides the rounding precision.

  ## Examples

      # 100 net, 17% added
      compute(Decimal.new(100), [gst], inclusive: false)
      #=> net 100.00, tax 17.00, gross 117.00

      # 117 gross, 17% backed out
      compute(Decimal.new(117), [gst], inclusive: true)
      #=> net 100.00, tax 17.00, gross 117.00
  """
  @spec compute(Decimal.t(), [Tax.t()], keyword()) :: result()
  def compute(amount, taxes, opts \\ [])

  def compute(%Decimal{} = amount, [], opts) do
    currency = Keyword.get(opts, :currency)
    rounded = Money.round(amount, currency)

    %{
      net: rounded,
      tax_total: Money.zero(),
      gross: rounded,
      lines: [],
      inclusive: Keyword.get(opts, :inclusive, false)
    }
  end

  def compute(%Decimal{} = amount, taxes, opts) do
    inclusive? = Keyword.get(opts, :inclusive, false)
    currency = Keyword.get(opts, :currency)
    applicable = Enum.filter(taxes, &active?/1)

    net = if inclusive?, do: derive_net(amount, applicable), else: amount

    lines = build_lines(net, applicable, currency)
    tax_total = lines |> Enum.map(& &1.amount) |> Money.sum()
    rounded_net = Money.round(net, currency)

    %{
      net: rounded_net,
      tax_total: tax_total,
      gross: Money.add(rounded_net, tax_total),
      lines: lines,
      inclusive: inclusive?
    }
  end

  @doc """
  The net amount hidden inside a tax-inclusive figure.

  Exposed separately because the checkout needs it when apportioning a
  whole-order discount across lines that already contain tax.
  """
  @spec derive_net(Decimal.t(), [Tax.t()]) :: Decimal.t()
  def derive_net(%Decimal{} = gross, taxes) do
    applicable = Enum.filter(taxes, &active?/1)

    {percentage, fixed} = Enum.split_with(applicable, &(&1.kind == "percentage"))

    fixed_total = fixed |> Enum.map(& &1.rate) |> Money.sum()
    # Run the forward calculation on a net of one: whatever it produces is the
    # factor the real net was multiplied by, whatever mix of simple and
    # compound rates is involved.
    multiplier = gross_multiplier(percentage)

    gross
    |> Money.sub(fixed_total)
    |> Money.div(multiplier)
    |> Money.clamp_non_negative()
  end

  @doc """
  The factor a net amount is multiplied by to reach gross.

  1.17 for a single 17% rate; 1.0815 for 5% followed by a compound 3%.
  """
  @spec gross_multiplier([Tax.t()]) :: Decimal.t()
  def gross_multiplier(taxes) do
    one = Decimal.new(1)

    Enum.reduce(taxes, one, fn tax, running ->
      base = if tax.is_compound, do: running, else: one

      Money.add(running, Money.rate_of(base, tax.rate))
    end)
  end

  @doc """
  The effective combined rate of a group, as a fraction.

  For display — "inclusive of 17% GST" on a receipt — rather than for
  calculation, which always goes through `compute/3`.
  """
  @spec effective_rate([Tax.t()]) :: Decimal.t()
  def effective_rate(taxes) do
    taxes
    |> Enum.filter(&(active?(&1) and &1.kind == "percentage"))
    |> gross_multiplier()
    |> Money.sub(Decimal.new(1))
  end

  # --- Internal ---------------------------------------------------------------

  # Walks the rates in order, so a compound rate sees the total accumulated
  # before it and a simple one always sees the bare net.
  defp build_lines(net, taxes, currency) do
    {lines, _running} =
      Enum.map_reduce(taxes, net, fn tax, running ->
        amount = line_amount(tax, net, running, currency)

        {build_line(tax, amount), Money.add(running, amount)}
      end)

    lines
  end

  defp line_amount(%Tax{kind: "fixed", rate: rate}, _net, _running, currency),
    do: Money.round(rate, currency)

  defp line_amount(%Tax{is_compound: true, rate: rate}, _net, running, currency),
    do: running |> Money.rate_of(rate) |> Money.round(currency)

  defp line_amount(%Tax{rate: rate}, net, _running, currency),
    do: net |> Money.rate_of(rate) |> Money.round(currency)

  defp build_line(%Tax{} = tax, amount) do
    %{
      tax_id: tax.id,
      name: tax.name,
      label: Tax.display_label(tax),
      rate: tax.rate,
      kind: tax.kind,
      compound: tax.is_compound,
      amount: amount
    }
  end

  defp active?(%Tax{is_active: true, deleted_at: nil}), do: true
  defp active?(%Tax{}), do: false
end
