defmodule Kaarobar.Money do
  @moduledoc """
  Decimal arithmetic with currency-correct rounding.

  Every monetary column is `numeric(16,4)`, and every calculation happens in
  `Decimal`. Four stored decimals is deliberately more than any currency needs:
  intermediate values — a 17% tax on a 33.33 line, a third of a bundle price —
  carry their extra digits until the moment a figure is *presented* as money,
  and only then are they rounded.

  Rounding once, late, is the difference between a sale that reconciles and one
  that is off by a rupee for reasons nobody can reconstruct. Rounding at each
  step compounds the error across every line.

  ## Minor units

  Most currencies have two. Some have none — a yen is a yen, and quoting 100.50
  of them is meaningless. A few have three. `minor_units/1` knows the
  exceptions, so a shop in Kuwait bills to three places and a shop in Tokyo
  bills to none, without either configuring anything.

  ## Half-up, not banker's rounding

  `Decimal`'s default is half-even, which is right for statistics and wrong for
  a till: a customer handed a receipt expects 0.005 to round up, every time,
  the way it does on paper. Half-up is what shop arithmetic means.
  """

  @default_minor_units 2

  # Currencies whose minor units are not two.
  @zero_decimal_currencies ~w(
    BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX UYI VND VUV XAF XOF XPF
  )

  @three_decimal_currencies ~w(BHD IQD JOD KWD LYD OMR TND)

  @rounding :half_up

  @type amount :: Decimal.t()

  @doc "Decimal zero."
  @spec zero() :: amount()
  def zero, do: Decimal.new(0)

  @doc """
  Coerces a value to `Decimal`.

  Floats are refused rather than converted. A float that reached a money field
  has already lost precision somewhere upstream, and quietly accepting it hides
  the bug behind a number that looks plausible.
  """
  @spec cast(term()) :: {:ok, amount()} | :error
  def cast(%Decimal{} = value), do: {:ok, value}
  def cast(value) when is_integer(value), do: {:ok, Decimal.new(value)}

  def cast(value) when is_binary(value) do
    case Decimal.parse(value) do
      {decimal, ""} -> {:ok, decimal}
      _other -> :error
    end
  end

  def cast(_value), do: :error

  @doc "Coerces to `Decimal`, falling back to zero."
  @spec to_decimal(term()) :: amount()
  def to_decimal(value) do
    case cast(value) do
      {:ok, decimal} -> decimal
      :error -> zero()
    end
  end

  @doc """
  How many decimal places this currency is quoted in.

  Unknown codes get two, which is right far more often than it is wrong.
  """
  @spec minor_units(String.t() | nil) :: non_neg_integer()
  def minor_units(nil), do: @default_minor_units

  def minor_units(currency) when is_binary(currency) do
    code = String.upcase(currency)

    cond do
      code in @zero_decimal_currencies -> 0
      code in @three_decimal_currencies -> 3
      true -> @default_minor_units
    end
  end

  @doc """
  Rounds an amount to its currency's minor units, half-up.

  This is the only place a figure should become "money". Call it when a value
  is about to be stored on an invoice line, totalled, or shown to a person —
  not between steps of a calculation.
  """
  @spec round(amount(), String.t() | nil) :: amount()
  def round(%Decimal{} = amount, currency \\ nil) do
    Decimal.round(amount, minor_units(currency), @rounding)
  end

  @doc """
  Rounds to full working precision — four decimals.

  For intermediate values that are stored but not yet presented, such as a
  resolved unit price before quantity is applied.
  """
  @spec round_working(amount()) :: amount()
  def round_working(%Decimal{} = amount), do: Decimal.round(amount, 4, @rounding)

  @doc "Adds amounts."
  @spec add(amount(), amount()) :: amount()
  def add(%Decimal{} = a, %Decimal{} = b), do: Decimal.add(a, b)

  @doc "Subtracts the second amount from the first."
  @spec sub(amount(), amount()) :: amount()
  def sub(%Decimal{} = a, %Decimal{} = b), do: Decimal.sub(a, b)

  @doc "Multiplies an amount by a factor."
  @spec mult(amount(), amount() | integer()) :: amount()
  def mult(%Decimal{} = a, %Decimal{} = b), do: Decimal.mult(a, b)
  def mult(%Decimal{} = a, b) when is_integer(b), do: Decimal.mult(a, Decimal.new(b))

  @doc """
  Divides, returning zero rather than raising when the divisor is zero.

  A zero divisor here means a rule with no quantity or a bundle with no
  components — a data problem that should not take the till down mid-sale. The
  zero is visible in the resulting total, which is how it gets noticed.
  """
  @spec div(amount(), amount() | integer()) :: amount()
  def div(%Decimal{} = a, %Decimal{} = b) do
    if Decimal.compare(b, 0) == :eq, do: zero(), else: Decimal.div(a, b)
  end

  def div(%Decimal{} = a, b) when is_integer(b), do: __MODULE__.div(a, Decimal.new(b))

  @doc "Sums a list of amounts."
  @spec sum([amount()]) :: amount()
  def sum(amounts), do: Enum.reduce(amounts, zero(), &add(&2, &1))

  @doc """
  A percentage of an amount, where `percent` is expressed out of 100.

  `percent_of(Decimal.new(200), Decimal.new(15))` is 30.
  """
  @spec percent_of(amount(), amount()) :: amount()
  def percent_of(%Decimal{} = amount, %Decimal{} = percent) do
    amount |> Decimal.mult(percent) |> Decimal.div(Decimal.new(100))
  end

  @doc "A fraction of an amount, where `rate` is expressed as a fraction of one."
  @spec rate_of(amount(), amount()) :: amount()
  def rate_of(%Decimal{} = amount, %Decimal{} = rate), do: Decimal.mult(amount, rate)

  @doc "True when the amount is exactly zero."
  @spec zero?(amount()) :: boolean()
  def zero?(%Decimal{} = amount), do: Decimal.compare(amount, 0) == :eq

  @doc "True when the amount is greater than zero."
  @spec positive?(amount()) :: boolean()
  def positive?(%Decimal{} = amount), do: Decimal.compare(amount, 0) == :gt

  @doc "True when the amount is less than zero."
  @spec negative?(amount()) :: boolean()
  def negative?(%Decimal{} = amount), do: Decimal.compare(amount, 0) == :lt

  @doc "The larger of two amounts."
  @spec max(amount(), amount()) :: amount()
  def max(%Decimal{} = a, %Decimal{} = b), do: if(Decimal.compare(a, b) == :lt, do: b, else: a)

  @doc "The smaller of two amounts."
  @spec min(amount(), amount()) :: amount()
  def min(%Decimal{} = a, %Decimal{} = b), do: if(Decimal.compare(a, b) == :gt, do: b, else: a)

  @doc """
  Clamps an amount to zero at the bottom.

  A discount larger than the line it applies to must not produce a negative
  price — the shop would be paying the customer to take the item.
  """
  @spec clamp_non_negative(amount()) :: amount()
  def clamp_non_negative(%Decimal{} = amount) do
    if negative?(amount), do: zero(), else: amount
  end

  @doc "Renders an amount as a lossless string, rounded to the currency."
  @spec to_string(amount(), String.t() | nil) :: String.t()
  def to_string(%Decimal{} = amount, currency \\ nil) do
    amount |> __MODULE__.round(currency) |> Decimal.to_string(:normal)
  end
end
