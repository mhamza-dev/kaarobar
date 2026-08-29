defmodule Kaarobar.Taxes.CalculationTest do
  @moduledoc """
  The tax arithmetic, in isolation.

  Pure functions over structs — no database — because these are the numbers
  that end up on an invoice, and they deserve to be checked exhaustively and
  fast rather than sparsely through a controller.
  """

  use ExUnit.Case, async: true

  alias Kaarobar.Money
  alias Kaarobar.Taxes.Calculation
  alias Kaarobar.Taxes.Tax

  defp tax(attrs) do
    struct!(
      %Tax{
        id: Ecto.UUID.generate(),
        name: "Tax",
        kind: "percentage",
        is_compound: false,
        is_active: true,
        deleted_at: nil
      },
      attrs
    )
  end

  defp gst(rate \\ "0.17"), do: tax(name: "GST", label: "GST", rate: Decimal.new(rate))

  defp amount(value), do: Decimal.new(value)

  defp assert_money(actual, expected) do
    assert Decimal.equal?(actual, Decimal.new(expected)),
           "expected #{expected}, got #{Decimal.to_string(actual, :normal)}"
  end

  describe "no taxes" do
    test "leaves the amount alone" do
      result = Calculation.compute(amount("100.00"), [])

      assert_money(result.net, "100.00")
      assert_money(result.tax_total, "0")
      assert_money(result.gross, "100.00")
      assert result.lines == []
    end
  end

  describe "exclusive pricing" do
    test "adds the tax on top" do
      result = Calculation.compute(amount("100.00"), [gst()], inclusive: false)

      assert_money(result.net, "100.00")
      assert_money(result.tax_total, "17.00")
      assert_money(result.gross, "117.00")
    end

    test "itemises each rate" do
      federal = tax(name: "GST", label: "GST", rate: Decimal.new("0.17"))
      provincial = tax(name: "PST", label: "PST", rate: Decimal.new("0.05"))

      result = Calculation.compute(amount("200.00"), [federal, provincial])

      assert [gst_line, pst_line] = result.lines
      assert gst_line.label == "GST"
      assert_money(gst_line.amount, "34.00")
      assert_money(pst_line.amount, "10.00")
      assert_money(result.tax_total, "44.00")
      assert_money(result.gross, "244.00")
    end

    test "the printed lines add up to the printed total" do
      # The first thing an auditor checks. Rounding the total separately from
      # the lines is how they stop agreeing.
      taxes = [gst("0.175"), tax(name: "Cess", rate: Decimal.new("0.025"))]

      result = Calculation.compute(amount("33.33"), taxes)

      summed = result.lines |> Enum.map(& &1.amount) |> Money.sum()
      assert Decimal.equal?(summed, result.tax_total)
      assert Decimal.equal?(Money.add(result.net, result.tax_total), result.gross)
    end
  end

  describe "inclusive pricing" do
    test "backs the tax out of the shelf price" do
      # 117 inclusive of 17% is 100 net — not 117 less 17%, which would be
      # 97.11. This is the single most common tax bug in point-of-sale software.
      result = Calculation.compute(amount("117.00"), [gst()], inclusive: true)

      assert_money(result.net, "100.00")
      assert_money(result.tax_total, "17.00")
      assert_money(result.gross, "117.00")
    end

    test "is the exact inverse of exclusive pricing" do
      for value <- ~w(1.00 33.33 99.99 250.00 1499.50) do
        forward = Calculation.compute(amount(value), [gst()], inclusive: false)
        back = Calculation.compute(forward.gross, [gst()], inclusive: true)

        assert Decimal.equal?(back.net, forward.net),
               "#{value}: round trip gave #{Decimal.to_string(back.net, :normal)}"
      end
    end

    test "a café pricing lunch at a round 250 still remits the right tax" do
      result = Calculation.compute(amount("250.00"), [gst()], inclusive: true)

      assert_money(result.gross, "250.00")
      # 250 / 1.17 = 213.675..., which rounds to 213.68
      assert_money(result.net, "213.68")
      assert_money(result.tax_total, "36.32")
    end
  end

  describe "compound rates" do
    test "charge on the running total, not the net" do
      # 5% then a compound 3% on 100 is 108.15, not 108.
      first = tax(name: "First", rate: Decimal.new("0.05"))
      second = tax(name: "Second", rate: Decimal.new("0.03"), is_compound: true)

      result = Calculation.compute(amount("100.00"), [first, second])

      assert [%{amount: five}, %{amount: three}] = result.lines
      assert_money(five, "5.00")
      assert_money(three, "3.15")
      assert_money(result.gross, "108.15")
    end

    test "order changes the answer, which is why position is stored" do
      simple = tax(name: "Simple", rate: Decimal.new("0.05"))
      compound = tax(name: "Compound", rate: Decimal.new("0.10"), is_compound: true)

      one_way = Calculation.compute(amount("100.00"), [simple, compound])
      other_way = Calculation.compute(amount("100.00"), [compound, simple])

      refute Decimal.equal?(one_way.gross, other_way.gross)
    end

    test "invert correctly too" do
      first = tax(name: "First", rate: Decimal.new("0.05"))
      second = tax(name: "Second", rate: Decimal.new("0.03"), is_compound: true)

      result = Calculation.compute(amount("108.15"), [first, second], inclusive: true)

      assert_money(result.net, "100.00")
      assert_money(result.gross, "108.15")
    end
  end

  describe "fixed rates" do
    test "add a constant rather than a proportion" do
      levy = tax(name: "Levy", kind: "fixed", rate: Decimal.new("5.00"))

      result = Calculation.compute(amount("100.00"), [levy])

      assert_money(result.tax_total, "5.00")
      assert_money(result.gross, "105.00")
    end

    test "are removed before inverting, since a constant does not scale" do
      levy = tax(name: "Levy", kind: "fixed", rate: Decimal.new("5.00"))

      result = Calculation.compute(amount("122.00"), [levy, gst()], inclusive: true)

      assert_money(result.net, "100.00")
      assert_money(result.gross, "122.00")
    end
  end

  describe "inactive rates" do
    test "are ignored" do
      retired = tax(name: "Old", rate: Decimal.new("0.10"), is_active: false)
      deleted = tax(name: "Gone", rate: Decimal.new("0.10"), deleted_at: DateTime.utc_now())

      result = Calculation.compute(amount("100.00"), [gst(), retired, deleted])

      assert length(result.lines) == 1
      assert_money(result.tax_total, "17.00")
    end
  end

  describe "currency precision" do
    test "a zero-decimal currency rounds to whole units" do
      result = Calculation.compute(amount("1000"), [gst()], currency: "JPY")

      assert_money(result.tax_total, "170")
      assert Decimal.scale(result.tax_total) == 0
    end

    test "a three-decimal currency keeps all three" do
      result = Calculation.compute(amount("100.000"), [gst()], currency: "KWD")

      assert_money(result.tax_total, "17.000")
    end
  end

  describe "gross_multiplier/1 and effective_rate/1" do
    test "a single rate multiplies by one plus the rate" do
      assert Decimal.equal?(Calculation.gross_multiplier([gst()]), Decimal.new("1.17"))
    end

    test "a compound pair compounds" do
      first = tax(name: "First", rate: Decimal.new("0.05"))
      second = tax(name: "Second", rate: Decimal.new("0.03"), is_compound: true)

      assert Decimal.equal?(
               Calculation.gross_multiplier([first, second]),
               Decimal.new("1.0815")
             )
    end

    test "the effective rate is what a receipt would print" do
      assert Decimal.equal?(Calculation.effective_rate([gst()]), Decimal.new("0.17"))
    end
  end

  describe "edge cases" do
    test "a zero amount produces zero tax" do
      result = Calculation.compute(amount("0"), [gst()])

      assert_money(result.tax_total, "0")
      assert_money(result.gross, "0")
    end

    test "a zero rate produces a line of zero rather than no line" do
      # An exempt item still prints "GST 0.00" on the invoice, which is what
      # tells a customer the shop considered it.
      zero_rated = tax(name: "GST", label: "GST", rate: Decimal.new("0"))

      result = Calculation.compute(amount("100.00"), [zero_rated])

      assert [%{amount: line_amount}] = result.lines
      assert_money(line_amount, "0")
    end

    test "an inclusive amount smaller than its fixed tax does not go negative" do
      levy = tax(name: "Levy", kind: "fixed", rate: Decimal.new("50.00"))

      result = Calculation.compute(amount("10.00"), [levy], inclusive: true)

      refute Money.negative?(result.net)
    end
  end
end
