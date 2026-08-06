defmodule Mix.Tasks.Kaarobar.Lemonsqueezy.SetupPlans do
  @shortdoc "Deprecated — Lemon Squeezy is retired; use Safepay"
  @moduledoc """
  **Deprecated.** Kaarobar SaaS billing now uses **Safepay** (Pakistan).

  Create subscription plans in the Safepay merchant dashboard, then set:

      SAFEPAY_API_KEY=
      SAFEPAY_SECRET_KEY=
      SAFEPAY_WEBHOOK_SECRET=
      SAFEPAY_ENVIRONMENT=sandbox
      SAFEPAY_PLAN_STARTER=
      SAFEPAY_PLAN_GROWTH=
      SAFEPAY_PLAN_ENTERPRISE=
      SAFEPAY_CHECKOUT_URL=   # optional static fallback when keys unset

  Point Safepay webhooks at `POST /api/v1/billing/webhook` (`X-SFPY-SIGNATURE`).

  See `docs/platform.md` and `Kaarobar.Billing.Safepay`.
  """

  use Mix.Task

  @impl Mix.Task
  def run(_args) do
    Mix.shell().error("""
    mix kaarobar.lemonsqueezy.setup_plans is deprecated.

    Lemon Squeezy is no longer on the live billing path.
    Configure Safepay plan IDs via SAFEPAY_PLAN_STARTER / _GROWTH / _ENTERPRISE
    (and optional subscription_plans.safepay_plan_id). See docs/platform.md.
    """)

    exit({:shutdown, 1})
  end
end
