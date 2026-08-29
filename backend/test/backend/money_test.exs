defmodule Kaarobar.MoneyTest do
  use ExUnit.Case, async: true

  alias Kaarobar.Money

  defp d(value), do: Decimal.new(value)

  defp assert_eq(actual, expected) do
    assert Decimal.equal?(actual, Decimal.new(expected)),
           "expected #{expected}, got #{Decimal.to_string(actual, :normal)}"
  end

  describe "cast/1" do
    test "accepts decimals, integers and numeric strings" do
      assert {:ok, value} = Money.cast(d("1.50"))
      assert_eq(value, "1.50")

      assert {:ok, from_int} = Money.cast(150)
      assert_eq(from_int, "150")

      assert {:ok, from_string} = Money.cast("1.50")
      assert_eq(from_string, "1.50")
    end

    test "refuses floats" do
      # A float that reached a money field lost precision upstream. Accepting
      # it hides the bug behind a number that looks plausible.
      assert :error = Money.cast(1.5)
    end

    test "refuses nonsense" do
      assert :error = Money.cast("not a number")
      assert :error = Money.cast(nil)
      assert :error = Money.cast(%{})
    end

    test "refuses a string with trailing junk" do
      assert :error = Money.cast("1.50abc")
    end
  end

  describe "minor_units/1" do
    test "defaults to two" do
      assert Money.minor_units("PKR") == 2
      assert Money.minor_units("USD") == 2
      assert Money.minor_units(nil) == 2
    end

    test "knows the zero-decimal currencies" do
      assert Money.minor_units("JPY") == 0
      assert Money.minor_units("KRW") == 0
      assert Money.minor_units("VND") == 0
    end

    test "knows the three-decimal currencies" do
      assert Money.minor_units("KWD") == 3
      assert Money.minor_units("BHD") == 3
      assert Money.minor_units("OMR") == 3
    end

    test "is case-insensitive" do
      assert Money.minor_units("jpy") == 0
    end

    test "treats an unknown code as two" do
      assert Money.minor_units("ZZZ") == 2
    end
  end

  describe "round/2" do
    test "rounds half up, the way shop arithmetic works" do
      # Decimal defaults to half-even, which would give 2.00 here. A customer
      # handed a receipt expects 0.005 to round up, every time.
      assert_eq(Money.round(d("2.005"), "PKR"), "2.01")
      assert_eq(Money.round(d("2.015"), "PKR"), "2.02")
      assert_eq(Money.round(d("2.025"), "PKR"), "2.03")
    end

    test "rounds to the currency's precision" do
      assert_eq(Money.round(d("100.567"), "JPY"), "101")
      assert_eq(Money.round(d("100.567"), "PKR"), "100.57")
      assert_eq(Money.round(d("100.5678"), "KWD"), "100.568")
    end

    test "round_working keeps four decimals for intermediate values" do
      assert_eq(Money.round_working(d("1.234567")), "1.2346")
    end
  end

  describe "arithmetic" do
    test "adds, subtracts and multiplies" do
      assert_eq(Money.add(d("1.10"), d("2.20")), "3.30")
      assert_eq(Money.sub(d("5.00"), d("1.25")), "3.75")
      assert_eq(Money.mult(d("2.50"), d("4")), "10.00")
      assert_eq(Money.mult(d("2.50"), 4), "10.00")
    end

    test "sums a list" do
      assert_eq(Money.sum([d("1.10"), d("2.20"), d("3.30")]), "6.60")
      assert_eq(Money.sum([]), "0")
    end

    test "dividing by zero yields zero rather than raising" do
      # A zero divisor means a rule with no quantity or a bundle with no
      # components — a data problem that must not take the till down mid-sale.
      assert_eq(Money.div(d("100"), d("0")), "0")
      assert_eq(Money.div(d("100"), d("4")), "25")
    end
  end

  describe "percentages and rates" do
    test "percent_of works out of 100" do
      assert_eq(Money.percent_of(d("200"), d("15")), "30")
    end

    test "rate_of works as a fraction of one" do
      assert_eq(Money.rate_of(d("200"), d("0.15")), "30.00")
    end
  end

  describe "predicates and clamping" do
    test "identifies zero, positive and negative" do
      assert Money.zero?(d("0"))
      assert Money.zero?(d("0.00"))
      assert Money.positive?(d("0.01"))
      assert Money.negative?(d("-0.01"))
      refute Money.positive?(d("0"))
    end

    test "min and max pick the right one" do
      assert_eq(Money.max(d("1"), d("2")), "2")
      assert_eq(Money.min(d("1"), d("2")), "1")
    end

    test "clamping stops a discount making the shop pay the customer" do
      assert_eq(Money.clamp_non_negative(d("-50")), "0")
      assert_eq(Money.clamp_non_negative(d("50")), "50")
    end
  end

  describe "to_string/2" do
    test "renders at the currency's precision" do
      assert Money.to_string(d("1499.5"), "PKR") == "1499.50"
      assert Money.to_string(d("1499.5"), "JPY") == "1500"
    end

    test "never uses scientific notation" do
      # Decimal.to_string/1 would render a large value as 1.0E+10, which a
      # client parsing money would read wrongly or not at all.
      refute Money.to_string(d("10000000000"), "PKR") =~ "E"
    end
  end
end
