defmodule Kaarobar.Payments.Gateway do
  @moduledoc """
  What a payment provider has to be able to do.

  Four adapters implement it: Stripe (cards, worldwide), JazzCash and Easypaisa
  (wallets, Pakistan), and Manual — for a shop with a card terminal that is not
  integrated at all, which is most of them.

  ## Manual is a real adapter, not a placeholder

  Most shops in this market take cards on a bank-supplied terminal that has no
  API. The cashier taps, the terminal prints a slip, and the slip number is
  typed in. Modelling that as "no gateway" would push the whole case out of the
  system; modelling it as an adapter means one code path handles every shop,
  and the ones who later integrate change a setting rather than a workflow.

  ## Every callback returns a normalised result

  Gateways disagree about everything — field names, status vocabularies, how
  money is expressed, what a signature covers. The adapter's job is to make all
  of that go away, so `Kaarobar.Payments` only ever sees `t:result/0` and the
  rest of the system never learns which provider took the money.

  ## Amounts cross this boundary as `Decimal`

  Adapters convert to and from whatever their provider wants — Stripe's minor
  units, JazzCash's zero-padded strings. Doing it here rather than at the edges
  keeps the conversion in one place per provider, which is where the rounding
  bugs would otherwise live.
  """

  alias Kaarobar.Payments.Provider

  @typedoc "A normalised outcome, whatever the provider actually said."
  @type result :: %{
          required(:status) => status(),
          required(:external_id) => String.t() | nil,
          optional(:checkout_url) => String.t() | nil,
          optional(:amount) => Decimal.t(),
          optional(:fee_amount) => Decimal.t() | nil,
          optional(:provider_status) => String.t() | nil,
          optional(:failure_code) => String.t() | nil,
          optional(:failure_message) => String.t() | nil,
          optional(:card_last_four) => String.t() | nil,
          optional(:card_scheme) => String.t() | nil,
          optional(:wallet_msisdn) => String.t() | nil,
          optional(:raw) => map()
        }

  @typedoc """
  The normalised statuses.

  `requires_action` is its own state rather than a kind of pending: a 3-D
  Secure challenge or a wallet PIN prompt means the *customer* has to do
  something, and a till that cannot tell that from "waiting on the network"
  either hurries the customer or gives up on them.
  """
  @type status ::
          :pending
          | :requires_action
          | :authorized
          | :captured
          | :failed
          | :cancelled
          | :refunded

  @typedoc "What the caller is asking the provider to do."
  @type charge_params :: %{
          required(:amount) => Decimal.t(),
          required(:currency) => String.t(),
          required(:reference) => String.t(),
          optional(:description) => String.t(),
          optional(:customer_email) => String.t() | nil,
          optional(:customer_phone) => String.t() | nil,
          optional(:return_url) => String.t() | nil,
          optional(:metadata) => map()
        }

  @doc """
  Starts a payment.

  Returns a `:pending` or `:requires_action` result carrying whatever the
  customer needs next — usually a `checkout_url`. It does not mean money has
  moved; only a webhook says that.
  """
  @callback create_charge(Provider.t(), charge_params()) ::
              {:ok, result()} | {:error, term()}

  @doc """
  Takes an authorised payment.

  Separate from `create_charge/2` because card rails authorise first and
  capture later, and a shop that captures before the goods are handed over has
  to refund rather than simply void when something goes wrong.
  """
  @callback capture(Provider.t(), external_id :: String.t(), Decimal.t()) ::
              {:ok, result()} | {:error, term()}

  @doc "Gives money back, in whole or in part."
  @callback refund(Provider.t(), external_id :: String.t(), Decimal.t()) ::
              {:ok, result()} | {:error, term()}

  @doc """
  Cancels a payment that has not been captured.

  Distinct from a refund: a void leaves no trace on the customer's statement,
  a refund leaves two entries and a week of waiting. Using the wrong one
  generates a support call every time.
  """
  @callback void(Provider.t(), external_id :: String.t()) ::
              {:ok, result()} | {:error, term()}

  @doc """
  Asks the provider what actually happened.

  The fallback when a webhook never arrived. A till that has been waiting two
  minutes needs an answer, and "ask the source" beats guessing.
  """
  @callback fetch_status(Provider.t(), external_id :: String.t()) ::
              {:ok, result()} | {:error, term()}

  @doc """
  Checks that a callback really came from the provider.

  Returns the parsed event or refuses it. An unverified webhook is an
  instruction from a stranger to mark a payment as paid, so this failing must
  reject the request rather than merely log.
  """
  @callback verify_webhook(Provider.t(), raw_body :: binary(), headers :: map()) ::
              {:ok, map()} | {:error, term()}

  @doc """
  Turns a provider's event into something the system understands.

  `nil` for events that are none of our business — providers send a great deal
  that a POS does not care about, and treating "we do not handle this" as an
  error fills the failure queue with noise.
  """
  @callback parse_event(map()) ::
              {:ok, %{external_id: String.t(), type: String.t(), result: result()}}
              | {:ok, nil}
              | {:error, term()}

  @doc "Whether this provider can capture separately from authorising."
  @callback supports_capture?() :: boolean()

  @doc "Whether this provider can be refunded through its API."
  @callback supports_refund?() :: boolean()

  @adapters %{
    "stripe" => Kaarobar.Payments.Adapters.Stripe,
    "jazzcash" => Kaarobar.Payments.Adapters.JazzCash,
    "easypaisa" => Kaarobar.Payments.Adapters.Easypaisa,
    "manual" => Kaarobar.Payments.Adapters.Manual
  }

  @doc "The adapter for a provider record."
  @spec adapter_for(Provider.t() | String.t()) :: {:ok, module()} | {:error, :unknown_provider}
  def adapter_for(%Provider{provider: provider}), do: adapter_for(provider)

  def adapter_for(provider) when is_binary(provider) do
    case Map.fetch(@adapters, provider) do
      {:ok, module} -> {:ok, module}
      :error -> {:error, :unknown_provider}
    end
  end

  @doc "Every provider the platform can talk to."
  @spec providers() :: [String.t()]
  def providers, do: Map.keys(@adapters)

  @doc """
  Maps a normalised status onto the intent status it produces.

  One place, so a new adapter cannot invent a state the rest of the system
  does not handle.
  """
  @spec intent_status(status()) :: String.t()
  def intent_status(:pending), do: "processing"
  def intent_status(:requires_action), do: "requires_action"
  def intent_status(:authorized), do: "authorized"
  def intent_status(:captured), do: "captured"
  def intent_status(:failed), do: "failed"
  def intent_status(:cancelled), do: "cancelled"
  def intent_status(:refunded), do: "refunded"
end
