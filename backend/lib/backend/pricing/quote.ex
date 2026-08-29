defmodule Kaarobar.Pricing.Quote do
  @moduledoc """
  The full derivation of one line's price.

  Not just the final number — every step that produced it. A cashier asked
  "why is this 340?" needs an answer, and a shop owner reconciling a day's
  margin needs to know which promotion cost them what. A function that returned
  only the total would make both questions unanswerable after the fact.

  The order the fields are derived in is the order they appear:

      base_price        the variant's shelf price
      list_price        after any price list override
      modifier_total    add-ons chosen at the counter
      discounts         promotions, in priority order
      unit_price        what one unit finally costs
      net               unit_price × quantity, less any tax it contained
      tax_lines         itemised, in application order
      gross             what the customer pays for this line

  The `source` fields say *why*: which price list, which rules. They are what
  the sale line stores, so a receipt reprinted in a year still explains itself
  even after the promotion has been deleted.
  """

  alias Kaarobar.Money

  @type discount :: %{
          rule_id: Ecto.UUID.t() | nil,
          name: String.t(),
          kind: String.t(),
          amount: Decimal.t()
        }

  @type t :: %__MODULE__{
          variant_id: Ecto.UUID.t() | nil,
          product_id: Ecto.UUID.t() | nil,
          currency: String.t() | nil,
          quantity: Decimal.t(),
          base_price: Decimal.t(),
          list_price: Decimal.t(),
          price_list_id: Ecto.UUID.t() | nil,
          modifier_total: Decimal.t(),
          discounts: [discount()],
          discount_total: Decimal.t(),
          unit_price: Decimal.t(),
          subtotal: Decimal.t(),
          net: Decimal.t(),
          tax_total: Decimal.t(),
          tax_lines: [map()],
          gross: Decimal.t(),
          tax_inclusive: boolean()
        }

  defstruct variant_id: nil,
            product_id: nil,
            currency: nil,
            quantity: nil,
            base_price: nil,
            list_price: nil,
            price_list_id: nil,
            modifier_total: nil,
            discounts: [],
            discount_total: nil,
            unit_price: nil,
            subtotal: nil,
            net: nil,
            tax_total: nil,
            tax_lines: [],
            gross: nil,
            tax_inclusive: false

  @doc "An empty quote, with every amount at zero."
  @spec new() :: t()
  def new do
    zero = Money.zero()

    %__MODULE__{
      quantity: zero,
      base_price: zero,
      list_price: zero,
      modifier_total: zero,
      discount_total: zero,
      unit_price: zero,
      subtotal: zero,
      net: zero,
      tax_total: zero,
      gross: zero
    }
  end

  @doc """
  Whether the customer is paying less than the shelf price for this line.

  Used to decide whether a receipt should print a "you saved" line, and by
  reporting to separate discounted sales from full-price ones.
  """
  @spec discounted?(t()) :: boolean()
  def discounted?(%__MODULE__{discount_total: total}), do: Money.positive?(total)

  @doc """
  The total saving against the shelf price, including any price-list override.

  A trade customer paying a lower list price *and* a promotion on top has saved
  both, and a receipt that only counts the promotion understates it.
  """
  @spec total_saving(t()) :: Decimal.t()
  def total_saving(%__MODULE__{} = quote) do
    list_saving =
      quote.base_price
      |> Money.sub(quote.list_price)
      |> Money.mult(quote.quantity)
      |> Money.clamp_non_negative()

    Money.add(list_saving, quote.discount_total)
  end

  @doc "The names of the promotions applied, for a receipt."
  @spec discount_names(t()) :: [String.t()]
  def discount_names(%__MODULE__{discounts: discounts}), do: Enum.map(discounts, & &1.name)
end
