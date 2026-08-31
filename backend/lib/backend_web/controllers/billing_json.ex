defmodule KaarobarWeb.BillingJSON do
  @moduledoc """
  Serialising plans, subscriptions and platform invoices.

  Money goes out as strings, the way it does everywhere else on this API. A
  price that arrived as a float would round somebody's bill in the JSON layer,
  where nobody would think to look for it.
  """

  alias Kaarobar.Billing.Invoice
  alias Kaarobar.Billing.Plan
  alias Kaarobar.Billing.PlanFeature
  alias Kaarobar.Billing.Subscription
  alias Kaarobar.Billing.SubscriptionItem
  alias KaarobarWeb.JSONHelpers, as: H

  def plans(%{plans: plans}), do: %{data: Enum.map(plans, &plan/1)}

  def subscription(%{subscription: nil}), do: %{data: nil}
  def subscription(%{subscription: subscription}), do: %{data: serialise(subscription)}

  def invoices(%{invoices: invoices}), do: %{data: Enum.map(invoices, &serialise_invoice/1)}

  def invoice(%{invoice: invoice}), do: %{data: serialise_invoice(invoice)}

  # --- Plans ------------------------------------------------------------------

  def plan(%Plan{} = plan) do
    %{
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      interval: plan.interval,
      currency: plan.currency,
      amount: money(plan.amount),
      trial_days: plan.trial_days,
      is_public: plan.is_public,
      features: features(plan.features),
      limits: limits(plan.features)
    }
  end

  # --- Subscription -----------------------------------------------------------

  defp serialise(%Subscription{} = subscription) do
    %{
      id: subscription.id,
      status: subscription.status,
      provider: subscription.provider,
      currency: subscription.currency,
      plan: preloaded_plan(subscription.plan),
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      trial_ends_at: subscription.trial_ends_at,
      grace_until: subscription.grace_until,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at,
      ended_at: subscription.ended_at,
      items: items(subscription.items),
      # Computed here rather than left to each client to infer from a status
      # and three dates — three clients inferring it would get it three ways,
      # and the one that got it wrong would tell a paying customer they had
      # been cut off.
      serviceable: Subscription.serviceable?(subscription),
      trialing: Subscription.trialing?(subscription),
      days_remaining: Subscription.days_remaining(subscription)
    }
  end

  defp preloaded_plan(%Plan{} = plan), do: plan(plan)
  defp preloaded_plan(_not_loaded), do: nil

  defp items(items) when is_list(items) do
    Enum.map(items, fn %SubscriptionItem{} = item ->
      %{
        kind: item.kind,
        quantity: item.quantity,
        unit_amount: money(item.unit_amount),
        amount: money(SubscriptionItem.amount(item))
      }
    end)
  end

  defp items(_not_loaded), do: []

  # --- Invoices ---------------------------------------------------------------

  defp serialise_invoice(%Invoice{} = invoice) do
    %{
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      currency: invoice.currency,
      subtotal: money(invoice.subtotal),
      tax_total: money(invoice.tax_total),
      total: money(invoice.total),
      amount_paid: money(invoice.amount_paid),
      outstanding: money(Invoice.outstanding(invoice)),
      period_start: invoice.period_start,
      period_end: invoice.period_end,
      due_at: invoice.due_at,
      paid_at: invoice.paid_at,
      overdue: Invoice.overdue?(invoice),
      # How many times we have asked, and what came back. Shown because a
      # customer chasing a failed payment deserves to see the same reason we
      # are acting on.
      attempts: invoice.attempts,
      last_error: invoice.last_error,
      lines: lines(invoice.lines)
    }
  end

  defp lines(lines) when is_list(lines) do
    Enum.map(lines, fn line ->
      %{
        description: line.description,
        quantity: line.quantity,
        unit_amount: money(line.unit_amount),
        amount: money(line.amount)
      }
    end)
  end

  defp lines(_not_loaded), do: []

  # --- Features ---------------------------------------------------------------

  defp features(features) when is_list(features) do
    features |> Enum.filter(& &1.is_enabled) |> Enum.map(& &1.key) |> Enum.sort()
  end

  defp features(_not_loaded), do: []

  # Null is unlimited, and it is sent as null rather than omitted — an absent
  # key reads as "no limit set" to one client and "limit of zero" to the next.
  defp limits(features) when is_list(features) do
    features
    |> Enum.filter(&(&1.is_enabled and not is_nil(&1.limit_value)))
    |> Map.new(fn %PlanFeature{} = feature -> {feature.key, feature.limit_value} end)
  end

  defp limits(_not_loaded), do: %{}

  # Through the shared helper, so a platform invoice renders its amounts the
  # same way a shop's own receipt does.
  defp money(amount), do: H.money(amount)
end
