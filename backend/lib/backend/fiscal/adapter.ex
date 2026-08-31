defmodule Kaarobar.Fiscal.Adapter do
  @moduledoc """
  What a tax authority's integration has to be able to do.

  Two implementations: `FBR` for Pakistan's real-time POS invoice regime, and
  `Generic` for the shape most other e-invoicing schemes take — post a
  document, get a number and a QR payload back.

  ## Rejection and failure are different things

  A *rejection* is the authority saying the invoice is wrong: a bad tax number,
  a total that does not add up, a product code it does not recognise. Retrying
  it will fail identically forever, and somebody has to fix the data.

  A *failure* is the authority not answering: a timeout, a 502, a certificate
  that expired at their end. That will very likely succeed on the next attempt.

  Collapsing the two means either retrying a permanently broken invoice
  hundreds of times, or giving up on a submission that a minute's patience
  would have completed. So the callback distinguishes them and the caller
  schedules accordingly.
  """

  alias Kaarobar.Fiscal.Config

  @typedoc """
  The result of asking an authority to register a document.

  `:rejected` carries the authority's own message, because that message is what
  tells the shopkeeper which field to correct — and no paraphrase of it is
  going to be more useful than the original.
  """
  @type result ::
          {:accepted,
           %{
             fiscal_number: String.t(),
             qr_payload: String.t() | nil,
             authority_reference: String.t() | nil,
             raw: map()
           }}
          | {:rejected, %{code: String.t() | nil, message: String.t(), raw: map()}}
          | {:failed, term()}

  @typedoc "The document being reported."
  @type document :: %{
          required(:kind) => String.t(),
          required(:number) => String.t(),
          required(:issued_at) => DateTime.t(),
          required(:currency) => String.t(),
          required(:subtotal) => Decimal.t(),
          required(:tax_total) => Decimal.t(),
          required(:total) => Decimal.t(),
          required(:lines) => [map()],
          optional(:buyer) => map() | nil,
          optional(:original_fiscal_number) => String.t() | nil
        }

  @doc """
  Registers a document with the authority.

  Returns accepted, rejected or failed — and the caller retries only the third.
  """
  @callback submit(Config.t(), document()) :: result()

  @doc """
  Builds the payload without sending it.

  Public in the behaviour so the shape can be tested and shown to an accountant
  without a live registration, which is how most integration problems are
  actually found.
  """
  @callback build_payload(Config.t(), document()) :: map()

  @doc "Whether this authority wants voids and refunds reported too."
  @callback reports_reversals?() :: boolean()

  @adapters %{
    "fbr" => Kaarobar.Fiscal.Adapters.FBR,
    "generic" => Kaarobar.Fiscal.Adapters.Generic
  }

  @doc "The adapter for a configuration."
  @spec for_config(Config.t() | String.t()) :: {:ok, module()} | {:error, :unknown_adapter}
  def for_config(%Config{adapter: adapter}), do: for_config(adapter)

  def for_config(adapter) when is_binary(adapter) do
    case Map.fetch(@adapters, adapter) do
      {:ok, module} -> {:ok, module}
      :error -> {:error, :unknown_adapter}
    end
  end

  @doc "Every authority the platform can file with."
  @spec adapters() :: [String.t()]
  def adapters, do: Map.keys(@adapters)

  @doc """
  How long to wait before trying again, in seconds.

  Exponential with a ceiling. An authority that is down is usually down for
  minutes, and hammering it every second neither helps them nor us — but a
  backoff that grows without limit means a submission quietly stops being
  retried at all.
  """
  @spec backoff_seconds(non_neg_integer()) :: pos_integer()
  def backoff_seconds(attempts) do
    (:math.pow(2, min(attempts, 8)) * 15) |> round() |> min(3600) |> max(15)
  end

  @doc """
  How many times to try before parking it for a person to look at.

  Bounded on purpose: an endpoint that has refused the same invoice nine times
  will refuse it a tenth, and retrying forever lets a shop believe it is
  compliant when it is not.
  """
  @spec max_attempts() :: pos_integer()
  def max_attempts, do: 9
end
