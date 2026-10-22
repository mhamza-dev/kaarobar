defmodule Kaarobar.Billing.Stripe do
  @moduledoc """
  Kaarobar's own Stripe account: how an organization pays *us*.

  Not `Kaarobar.Payments.Adapters.Stripe`, which takes a shop's card payments
  on the shop's own Stripe account with credentials the shop typed in. This one
  has a single set of credentials, ours, from the environment — and the two
  must never be confused, or a shop's customers end up paying our invoices.

  It does reuse that adapter's webhook verification, and the same HTTP seam,
  because a signature check is the one piece of code here that has to be right
  and there is no reason to have two of them.

  ## Hosted pages, never card numbers

  Payment is taken on Stripe Checkout and managed on Stripe's customer portal.
  Card details never touch this API or any of our clients, which keeps every
  one of them out of PCI scope.

  ## Optional

  A deployment with no `STRIPE_BILLING_SECRET_KEY` has no card billing at all:
  trials still run and invoices are still issued, and somebody settles them by
  hand. `configured?/0` is how a client knows not to offer the button.

  ## Configuration

      config :backend, Kaarobar.Billing.Stripe,
        secret_key: "sk_live_…",
        webhook_secret: "whsec_…",
        http: Kaarobar.Payments.HTTP   # replaced in test
  """

  alias Kaarobar.Billing.Plan
  alias Kaarobar.Money
  alias Kaarobar.Payments.Adapters.Stripe, as: StripeAdapter
  alias Kaarobar.Payments.Provider

  @api "https://api.stripe.com/v1"

  # Stripe refuses a Checkout trial that ends sooner than this. A trial with
  # less left than that is charged now instead, which is what the customer
  # clicking "pay" is asking for anyway.
  @min_trial_seconds 48 * 3600

  @doc "True when card billing is switched on for this deployment."
  @spec configured?() :: boolean()
  def configured?, do: present?(config(:secret_key))

  @doc """
  Opens a Checkout session for a plan.

  `opts`:

    * `:organization_id` — required; it rides along as metadata on the session
      *and* the subscription, so every later webhook can say whose it is
      without a lookup across tenants
    * `:customer_id` — an existing Stripe customer, to keep one per organization
    * `:email` — prefilled when there is no customer yet
    * `:trial_end` — a `DateTime`; the card is taken now and charged then
    * `:success_url`, `:cancel_url` — where Stripe sends the customer back
  """
  @spec create_checkout_session(Plan.t(), keyword()) ::
          {:ok, %{id: String.t(), url: String.t()}} | {:error, term()}
  def create_checkout_session(%Plan{} = plan, opts) do
    organization_id = Keyword.fetch!(opts, :organization_id)

    body =
      %{
        "mode" => "subscription",
        "client_reference_id" => organization_id,
        "success_url" => Keyword.fetch!(opts, :success_url),
        "cancel_url" => Keyword.fetch!(opts, :cancel_url),
        "line_items[0][quantity]" => "1",
        "metadata[organization_id]" => organization_id,
        "metadata[plan_code]" => plan.code,
        "subscription_data[metadata][organization_id]" => organization_id,
        "subscription_data[metadata][plan_code]" => plan.code,
        "allow_promotion_codes" => "true"
      }
      |> Map.merge(price_params(plan))
      |> Map.merge(customer_params(opts))
      |> Map.merge(trial_params(Keyword.get(opts, :trial_end)))

    with {:ok, session} <- post("/checkout/sessions", body) do
      {:ok, %{id: session["id"], url: session["url"]}}
    end
  end

  @doc "Opens the customer portal, where a card is changed or a plan cancelled."
  @spec create_portal_session(String.t(), String.t()) ::
          {:ok, %{url: String.t()}} | {:error, term()}
  def create_portal_session(customer_id, return_url) do
    body = %{"customer" => customer_id, "return_url" => return_url}

    with {:ok, session} <- post("/billing_portal/sessions", body) do
      {:ok, %{url: session["url"]}}
    end
  end

  @doc "A subscription as Stripe has it now."
  @spec fetch_subscription(String.t()) :: {:ok, map()} | {:error, term()}
  def fetch_subscription(id), do: get("/subscriptions/#{URI.encode(id)}")

  @doc """
  Checks a webhook's signature and returns the decoded event.

  Through the shop adapter's verification, so there is exactly one
  implementation of the comparison that decides whether a stranger can tell us
  an organization has paid.
  """
  @spec verify_webhook(binary(), map()) :: {:ok, map()} | {:error, term()}
  def verify_webhook(raw_body, headers) do
    case config(:webhook_secret) do
      secret when is_binary(secret) and secret != "" ->
        StripeAdapter.verify_webhook(provider(%{"value" => secret}), raw_body, headers)

      _missing ->
        {:error, :webhook_secret_missing}
    end
  end

  @doc """
  Our status for one of Stripe's, or nil for the ones that change nothing.

  `incomplete` is a Checkout that has not been paid for yet, and
  `incomplete_expired` is one that never was. Neither is a subscription the
  organization has, so neither may overwrite the one it does.
  """
  @spec map_status(String.t() | nil) :: String.t() | nil
  def map_status("trialing"), do: "trialing"
  def map_status("active"), do: "active"
  def map_status("past_due"), do: "past_due"
  # Stripe's dunning has run out, but ours decides when access ends.
  def map_status("unpaid"), do: "past_due"
  def map_status("paused"), do: "paused"
  def map_status("canceled"), do: "canceled"
  def map_status(_other), do: nil

  @doc """
  The period a Stripe subscription is in, as `{start, end}`.

  Newer API versions moved the period from the subscription onto its items;
  which one arrives depends on the version the webhook endpoint was created
  with, so both are read.
  """
  @spec period(map()) :: {DateTime.t() | nil, DateTime.t() | nil}
  def period(subscription) do
    item = get_in(subscription, ["items", "data", Access.at(0)]) || %{}

    {
      from_unix(subscription["current_period_start"] || item["current_period_start"]),
      from_unix(subscription["current_period_end"] || item["current_period_end"])
    }
  end

  @doc "The price a Stripe subscription is on, for matching it to a plan."
  @spec price_id(map()) :: String.t() | nil
  def price_id(subscription) do
    get_in(subscription, ["items", "data", Access.at(0), "price", "id"])
  end

  @doc """
  Which subscription an invoice belongs to, and whose it is.

  Again version-dependent: older payloads carry `subscription` and
  `subscription_details` at the top, newer ones under `parent`.
  """
  @spec invoice_subscription(map()) :: {String.t() | nil, String.t() | nil}
  def invoice_subscription(invoice) do
    details =
      invoice["subscription_details"] ||
        get_in(invoice, ["parent", "subscription_details"]) || %{}

    subscription_id =
      case invoice["subscription"] || details["subscription"] do
        %{"id" => id} -> id
        id -> id
      end

    {subscription_id, get_in(details, ["metadata", "organization_id"])}
  end

  @doc "A Unix timestamp from Stripe as a `DateTime`, or nil."
  @spec from_unix(integer() | nil) :: DateTime.t() | nil
  def from_unix(nil), do: nil

  # Microsecond precision, because the columns are `utc_datetime_usec` and
  # Ecto refuses a second-precision value for one.
  def from_unix(seconds) when is_integer(seconds) do
    %{DateTime.from_unix!(seconds) | microsecond: {0, 6}}
  end

  def from_unix(_other), do: nil

  @doc "An amount in Stripe's minor units as a `Decimal` in the currency."
  @spec from_minor(integer() | nil, String.t()) :: Decimal.t()
  def from_minor(nil, _currency), do: Money.zero()

  def from_minor(minor, currency) when is_integer(minor) do
    minor |> Decimal.new() |> Decimal.div(factor(currency)) |> Money.round(currency)
  end

  # ===========================================================================
  # Internal
  # ===========================================================================

  # A plan priced in the Stripe dashboard is referred to by its id. One that
  # is not is described inline, which is what lets a fresh deployment take
  # money before anybody has set prices up on the Stripe side.
  defp price_params(%Plan{external_price_id: price_id})
       when is_binary(price_id) and price_id != "",
       do: %{"line_items[0][price]" => price_id}

  defp price_params(%Plan{} = plan) do
    %{
      "line_items[0][price_data][currency]" => String.downcase(plan.currency),
      "line_items[0][price_data][unit_amount]" => to_string(to_minor(plan.amount, plan.currency)),
      "line_items[0][price_data][recurring][interval]" => plan.interval,
      "line_items[0][price_data][product_data][name]" => "Kaarobar #{plan.name}"
    }
  end

  defp customer_params(opts) do
    case {Keyword.get(opts, :customer_id), Keyword.get(opts, :email)} do
      {id, _email} when is_binary(id) and id != "" -> %{"customer" => id}
      {_none, email} when is_binary(email) and email != "" -> %{"customer_email" => email}
      _neither -> %{}
    end
  end

  defp trial_params(%DateTime{} = trial_end) do
    if DateTime.diff(trial_end, DateTime.utc_now()) >= @min_trial_seconds do
      %{"subscription_data[trial_end]" => to_string(DateTime.to_unix(trial_end))}
    else
      %{}
    end
  end

  defp trial_params(_none), do: %{}

  defp post(path, body), do: http().post_form(provider(), @api <> path, body, auth())
  defp get(path), do: http().get(provider(), @api <> path, auth())

  defp auth, do: [{"authorization", "Bearer #{config(:secret_key)}"}]

  # The transport takes a provider, because shops' gateways each have their
  # own. Ours is built in memory and never stored.
  defp provider(webhook_secret \\ nil) do
    %Provider{
      provider: "stripe",
      display_name: "Kaarobar billing",
      mode: "live",
      credentials: %{"secret_key" => config(:secret_key)},
      webhook_secret: webhook_secret
    }
  end

  defp to_minor(%Decimal{} = amount, currency) do
    amount |> Decimal.mult(factor(currency)) |> Decimal.round(0) |> Decimal.to_integer()
  end

  defp factor(currency), do: :math.pow(10, Money.minor_units(currency)) |> round()

  defp http, do: config(:http) || Kaarobar.Payments.HTTP

  defp config(key) do
    :backend |> Application.get_env(__MODULE__, []) |> Keyword.get(key)
  end

  defp present?(value), do: is_binary(value) and value != ""
end
