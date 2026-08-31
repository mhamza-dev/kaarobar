defmodule KaarobarWeb.PaymentJSON do
  @moduledoc """
  Gateway payments, as JSON.

  A provider goes out without its credentials, and there is no read path for
  them anywhere. A shop that has lost a secret key replaces it — which is what
  its gateway would tell them to do too.
  """

  alias Kaarobar.Payments.Provider
  alias KaarobarWeb.JSONHelpers, as: H

  def providers(%{providers: providers}), do: %{data: Enum.map(providers, &provider_json/1)}
  def provider(%{provider: provider}), do: %{data: provider_json(provider)}

  def intents(%{intents: intents}), do: %{data: Enum.map(intents, &intent_json/1)}
  def intent(%{intent: intent}), do: %{data: intent_json(intent)}

  def settlements(%{settlements: settlements}),
    do: %{data: Enum.map(settlements, &settlement_json/1)}

  def settlement(%{settlement: settlement}), do: %{data: settlement_json(settlement)}

  # Credentials and the webhook secret are deliberately absent. `public_config`
  # is the half a browser is meant to see, kept apart so that leaving the
  # secrets out is not a decision anyone has to remember to make twice.
  defp provider_json(%Provider{} = provider) do
    %{
      id: provider.id,
      provider: provider.provider,
      display_name: provider.display_name,
      mode: provider.mode,
      public_config: provider.public_config,
      webhook_url: provider.webhook_url,
      is_active: provider.is_active,
      is_default: provider.is_default,
      configured: not is_nil(provider.credentials),
      webhook_configured: not is_nil(provider.webhook_secret)
    }
  end

  defp intent_json(intent) do
    %{
      id: intent.id,
      reference: intent.reference,
      status: intent.status,
      amount: H.money(intent.amount),
      currency: intent.currency,
      captured_amount: H.money(intent.captured_amount),
      refunded_amount: H.money(intent.refunded_amount),
      external_id: intent.external_id,
      checkout_url: intent.checkout_url,
      failure_code: intent.failure_code,
      failure_message: intent.failure_message,
      sale_id: intent.sale_id,
      order_id: intent.order_id,
      customer_id: intent.customer_id,
      payment_provider_id: intent.payment_provider_id,
      authorized_at: H.timestamp(intent.authorized_at),
      captured_at: H.timestamp(intent.captured_at),
      failed_at: H.timestamp(intent.failed_at),
      transactions: H.preloaded(intent.transactions, &transaction_json/1)
    }
  end

  defp transaction_json(transaction) do
    %{
      id: transaction.id,
      kind: transaction.kind,
      status: transaction.status,
      amount: H.money(transaction.amount),
      fee_amount: H.money(transaction.fee_amount),
      net_amount: H.money(transaction.net_amount),
      external_id: transaction.external_id,
      provider_status: transaction.provider_status,
      failure_code: transaction.failure_code,
      failure_message: transaction.failure_message,
      card_last_four: transaction.card_last_four,
      card_scheme: transaction.card_scheme,
      occurred_at: H.timestamp(transaction.occurred_at)
    }
  end

  defp settlement_json(settlement) do
    %{
      id: settlement.id,
      external_id: settlement.external_id,
      status: settlement.status,
      gross_amount: H.money(settlement.gross_amount),
      fee_amount: H.money(settlement.fee_amount),
      refund_amount: H.money(settlement.refund_amount),
      net_amount: H.money(settlement.net_amount),
      variance: H.money(settlement.variance),
      currency: settlement.currency,
      transaction_count: settlement.transaction_count,
      period_start: H.date(settlement.period_start),
      period_end: H.date(settlement.period_end),
      paid_out_at: H.timestamp(settlement.paid_out_at),
      reconciled_at: H.timestamp(settlement.reconciled_at)
    }
  end
end
