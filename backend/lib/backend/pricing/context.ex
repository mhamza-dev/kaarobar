defmodule Kaarobar.Pricing.Context do
  @moduledoc """
  Everything needed to price a cart, loaded once.

  Built by `Kaarobar.Pricing.context/2` and then read-only. Two reasons it
  exists rather than each line fetching what it needs:

  **Queries.** A ten-line cart would otherwise run ten sets of promotion and
  price-list lookups, at the till, while a customer waits.

  **Consistency.** `at` is fixed for the whole cart, so a happy hour cannot
  expire between line three and line four. A sale is priced at one instant, and
  that instant is recorded here.
  """

  alias Kaarobar.Pricing.PriceList
  alias Kaarobar.Pricing.PriceRule

  @type t :: %__MODULE__{
          at: DateTime.t(),
          branch_id: Ecto.UUID.t() | nil,
          channel: String.t(),
          currency: String.t() | nil,
          tax_inclusive: boolean(),
          coupon_codes: [String.t()],
          price_lists: [PriceList.t()],
          rules: [PriceRule.t()]
        }

  defstruct at: nil,
            branch_id: nil,
            channel: "pos",
            currency: nil,
            tax_inclusive: false,
            coupon_codes: [],
            price_lists: [],
            rules: []

  @doc "True when a coupon code was quoted by the customer."
  @spec coupon?(t(), String.t()) :: boolean()
  def coupon?(%__MODULE__{coupon_codes: codes}, code) when is_binary(code),
    do: String.upcase(code) in codes

  def coupon?(%__MODULE__{}, _code), do: false

  @doc """
  The promotions live in this context, for showing a customer what is on offer
  before anything is in the basket.
  """
  @spec live_rules(t()) :: [PriceRule.t()]
  def live_rules(%__MODULE__{rules: rules}), do: rules
end
