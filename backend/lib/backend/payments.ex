defmodule Kaarobar.Payments do
  @moduledoc """
  Taking money through somebody else's rails.

  ## The webhook is the truth

  A browser redirect proves nothing: customers close tabs, lose signal and hit
  back. `handle_webhook/3` is where a payment actually becomes real, and it is
  the only path that moves an intent to captured — apart from `sync/2`, which
  asks the provider directly when a callback never came.

  ## Replays are no-ops, by construction

  Every gateway retries and several deliver out of order. The event is written
  first, behind a unique index on `(provider, external_id)`; a duplicate loses
  the insert and returns the original without touching the payment. That is the
  difference between an extra row and charging a customer twice.

  Out-of-order delivery is handled separately, in
  `Kaarobar.Payments.Intent.result_changeset/2`: statuses only move forward, so
  a late "pending" arriving after a capture is ignored rather than un-capturing
  the payment.

  ## Nothing is trusted before the signature is checked

  An unverified callback is an instruction from a stranger to mark a payment as
  paid. It is stored — losing evidence of a forgery attempt helps nobody — but
  it is never acted on.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Audit
  alias Kaarobar.Money
  alias Kaarobar.Payments.Gateway
  alias Kaarobar.Payments.Intent
  alias Kaarobar.Payments.Provider
  alias Kaarobar.Payments.Settlement
  alias Kaarobar.Payments.Transaction
  alias Kaarobar.Payments.WebhookEvent
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Scope
  alias Kaarobar.Sequences

  require Logger

  # ===========================================================================
  # Providers
  # ===========================================================================

  @doc "The business's configured gateways."
  @spec list_providers(Scope.t()) :: [Provider.t()]
  def list_providers(%Scope{} = scope) do
    Provider
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> order_by([provider], asc: provider.display_name)
    |> Repo.all()
  end

  @doc "Fetches a provider."
  @spec fetch_provider(Scope.t(), Ecto.UUID.t()) :: {:ok, Provider.t()} | {:error, :not_found}
  def fetch_provider(%Scope{} = scope, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      Provider
      |> Scoped.for_business(scope)
      |> Scoped.active()
      |> where([provider], provider.id == ^id)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        provider -> {:ok, provider}
      end
    else
      {:error, :not_found}
    end
  end

  @doc "The gateway a payment uses when the caller does not name one."
  @spec default_provider(Scope.t()) :: Provider.t() | nil
  def default_provider(%Scope{} = scope) do
    Provider
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> where([provider], provider.is_default and provider.is_active)
    |> Repo.one()
  end

  @doc "Configures a gateway. Credentials are encrypted on the way in."
  @spec configure_provider(Scope.t(), map()) :: {:ok, Provider.t()} | {:error, term()}
  def configure_provider(%Scope{} = scope, attrs) do
    changeset =
      %Provider{
        organization_id: Scope.organization_id(scope),
        business_id: Scope.business_id(scope)
      }
      |> Provider.changeset(attrs)

    with {:ok, provider} <- Repo.insert(changeset) do
      # Deliberately no credential detail in the audit trail: the point of
      # encrypting them is undone by writing them somewhere else.
      Audit.log(scope, "payment_provider.configured", provider,
        entity_type: "payment_provider",
        label: provider.display_name,
        summary: "#{provider.provider} in #{provider.mode} mode"
      )

      {:ok, provider}
    end
  end

  @doc "Updates a gateway's configuration."
  @spec update_provider(Scope.t(), Provider.t(), map()) ::
          {:ok, Provider.t()} | {:error, Ecto.Changeset.t()}
  def update_provider(%Scope{}, %Provider{} = provider, attrs),
    do: provider |> Provider.changeset(attrs) |> Repo.update()

  @doc "Retires a gateway. Past payments keep their history."
  @spec delete_provider(Scope.t(), Provider.t()) ::
          {:ok, Provider.t()} | {:error, Ecto.Changeset.t()}
  def delete_provider(%Scope{}, %Provider{} = provider),
    do: provider |> Provider.soft_delete_changeset() |> Repo.update()

  # ===========================================================================
  # Charging
  # ===========================================================================

  @doc """
  Asks for money.

  Writes the intent first, then calls the gateway — so a provider that answers
  and then times out on the way back has still left a row to reconcile against.
  The reverse order would lose the payment entirely.

  The intent comes back `processing` or `requires_action`; it does not become
  `captured` until a webhook says so.
  """
  @spec charge(Scope.t(), map()) :: {:ok, Intent.t()} | {:error, term()}
  def charge(%Scope{} = scope, attrs) do
    attrs = stringify(attrs)

    with {:ok, provider} <- resolve_provider(scope, Map.get(attrs, "payment_provider_id")),
         {:ok, adapter} <- Gateway.adapter_for(provider),
         {:ok, intent} <- open_intent(scope, provider, attrs) do
      case adapter.create_charge(provider, charge_params(intent, attrs)) do
        {:ok, result} ->
          apply_result(scope, intent, result, kind_for(result))

        {:error, reason} ->
          # The intent survives the failure on purpose: a gateway that took the
          # money and then failed to answer leaves a row the reconciliation job
          # can chase.
          {:ok, _failed} = record_failure(intent, reason)
          {:error, reason}
      end
    end
  end

  @doc "Takes an authorised payment."
  @spec capture(Scope.t(), Intent.t(), Decimal.t() | nil) ::
          {:ok, Intent.t()} | {:error, term()}
  def capture(%Scope{} = scope, %Intent{} = intent, amount \\ nil) do
    amount = amount || intent.amount

    with {:ok, provider} <- load_provider(intent),
         {:ok, adapter} <- Gateway.adapter_for(provider),
         {:ok, result} <- adapter.capture(provider, intent.external_id, amount) do
      Repo.transaction(fn ->
        with {:ok, captured} <- intent |> Intent.capture_changeset(amount) |> Repo.update(),
             {:ok, _transaction} <- write_transaction(scope, captured, result, "capture", amount) do
          captured
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end
  end

  @doc """
  Gives money back.

  Refused beyond what was captured — the gateway would refuse it too, but
  finding out here means the cashier is told why rather than shown a provider
  error code.
  """
  @spec refund(Scope.t(), Intent.t(), Decimal.t()) :: {:ok, Intent.t()} | {:error, term()}
  def refund(%Scope{} = scope, %Intent{} = intent, amount) do
    amount = Money.to_decimal(amount)

    cond do
      not Intent.settled?(intent) ->
        {:error, :not_captured}

      Decimal.compare(amount, Intent.refundable_amount(intent)) == :gt ->
        {:error, {:exceeds_refundable, Intent.refundable_amount(intent)}}

      true ->
        do_refund(scope, intent, amount)
    end
  end

  @doc """
  Asks the provider what actually happened.

  The fallback when a webhook never arrived. A till that has been waiting two
  minutes needs an answer, and asking the source beats guessing.
  """
  @spec sync(Scope.t(), Intent.t()) :: {:ok, Intent.t()} | {:error, term()}
  def sync(%Scope{}, %Intent{external_id: nil}), do: {:error, :not_submitted}

  def sync(%Scope{} = scope, %Intent{} = intent) do
    with {:ok, provider} <- load_provider(intent),
         {:ok, adapter} <- Gateway.adapter_for(provider),
         {:ok, result} <- adapter.fetch_status(provider, intent.external_id) do
      apply_result(scope, intent, result, "sale")
    end
  end

  @doc "Intents, newest first."
  @spec list_intents(Scope.t(), keyword()) :: [Intent.t()]
  def list_intents(%Scope{} = scope, opts \\ []) do
    Intent
    |> Scoped.for_business(scope)
    |> filter_status(Keyword.get(opts, :status))
    |> order_by([intent], desc: intent.inserted_at)
    |> preload([:payment_provider, :transactions])
    |> Repo.all()
  end

  @doc "Fetches an intent with its attempts."
  @spec fetch_intent(Scope.t(), Ecto.UUID.t()) :: {:ok, Intent.t()} | {:error, :not_found}
  def fetch_intent(%Scope{} = scope, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      Intent
      |> Scoped.for_business(scope)
      |> where([intent], intent.id == ^id)
      |> preload([:payment_provider, :transactions])
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        intent -> {:ok, intent}
      end
    else
      {:error, :not_found}
    end
  end

  @doc """
  Intents that have been waiting long enough to chase.

  What the reconciliation job reads: a webhook that has not arrived in five
  minutes may never arrive.
  """
  @spec stale_intents(Scope.t(), non_neg_integer()) :: [Intent.t()]
  def stale_intents(%Scope{} = scope, seconds \\ 300) do
    cutoff = DateTime.add(DateTime.utc_now(), -seconds, :second)

    Intent
    |> Scoped.for_business(scope)
    |> where([intent], intent.status in ^Intent.open_statuses())
    |> where([intent], intent.inserted_at < ^cutoff)
    |> preload(:payment_provider)
    |> Repo.all()
  end

  # ===========================================================================
  # Webhooks
  # ===========================================================================

  @doc """
  Takes a callback from a gateway.

  Stores it first, verifies the signature, then acts. Storing first is
  deliberate: a handler that crashes must not lose the event, because the
  gateway may not send it again — and the one it would not resend is the one
  saying the money arrived.

  A replay returns the original event untouched. That is what the unique index
  on `(provider, external_id)` is for.
  """
  @spec handle_webhook(String.t(), binary(), map()) ::
          {:ok, WebhookEvent.t()} | {:error, term()}
  def handle_webhook(provider_name, raw_body, headers) do
    with {:ok, adapter} <- Gateway.adapter_for(provider_name),
         {:ok, provider} <- provider_for_webhook(provider_name, raw_body, headers),
         {:ok, payload} <- verify(adapter, provider, raw_body, headers),
         {:ok, event} <- store_event(provider, provider_name, payload) do
      if event.status == "processed" do
        # A replay. The original stands; nothing else happens.
        {:ok, event}
      else
        process_event(adapter, provider, event, payload)
      end
    end
  end

  @doc "Events still waiting to be acted on, oldest first."
  @spec pending_events(Scope.t()) :: [WebhookEvent.t()]
  def pending_events(%Scope{} = scope) do
    WebhookEvent
    |> Scoped.for_business(scope)
    |> where([event], event.status in ["received", "failed"])
    |> order_by([event], asc: event.received_at)
    |> Repo.all()
  end

  # ===========================================================================
  # Settlements
  # ===========================================================================

  @doc "Records a payout the gateway says it made."
  @spec record_settlement(Scope.t(), Provider.t(), map()) ::
          {:ok, Settlement.t()} | {:error, term()}
  def record_settlement(%Scope{} = scope, %Provider{} = provider, attrs) do
    %Settlement{}
    |> Settlement.changeset(
      Map.merge(stringify(attrs), %{
        "organization_id" => Scope.organization_id(scope),
        "business_id" => Scope.business_id(scope),
        "payment_provider_id" => provider.id
      })
    )
    |> Repo.insert()
  end

  @doc "Payouts, newest first."
  @spec list_settlements(Scope.t()) :: [Settlement.t()]
  def list_settlements(%Scope{} = scope) do
    Settlement
    |> Scoped.for_business(scope)
    |> order_by([settlement], desc: settlement.period_end)
    |> preload(:payment_provider)
    |> Repo.all()
  end

  @doc "Marks a payout as matched against the bank."
  @spec reconcile(Scope.t(), Settlement.t(), String.t() | nil) ::
          {:ok, Settlement.t()} | {:error, Ecto.Changeset.t()}
  def reconcile(%Scope{} = scope, %Settlement{} = settlement, notes) do
    settlement
    |> Settlement.reconcile_changeset(Scope.user_id(scope), notes)
    |> Repo.update()
  end

  # ===========================================================================
  # Internal
  # ===========================================================================

  defp resolve_provider(%Scope{} = scope, nil) do
    case default_provider(scope) do
      nil -> {:error, :no_payment_provider}
      provider -> {:ok, provider}
    end
  end

  defp resolve_provider(%Scope{} = scope, id) do
    with {:ok, provider} <- fetch_provider(scope, id) do
      if Provider.usable?(provider), do: {:ok, provider}, else: {:error, :provider_inactive}
    end
  end

  defp load_provider(%Intent{} = intent) do
    case Repo.get(Provider, intent.payment_provider_id) do
      nil -> {:error, :not_found}
      provider -> {:ok, provider}
    end
  end

  defp open_intent(%Scope{} = scope, %Provider{} = provider, attrs) do
    Repo.transaction(fn ->
      with {:ok, reference} <- Sequences.next(scope, "payment_intent"),
           {:ok, intent} <- insert_intent(scope, provider, attrs, reference) do
        intent
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  defp insert_intent(%Scope{} = scope, %Provider{} = provider, attrs, reference) do
    %Intent{}
    |> Intent.changeset(
      Map.merge(attrs, %{
        "organization_id" => Scope.organization_id(scope),
        "business_id" => Scope.business_id(scope),
        "branch_id" => Scope.branch_id(scope),
        "payment_provider_id" => provider.id,
        "reference" => reference,
        "currency" => Map.get(attrs, "currency") || currency_of(scope),
        "created_by_id" => Scope.user_id(scope)
      })
    )
    |> Repo.insert()
  end

  defp charge_params(%Intent{} = intent, attrs) do
    %{
      amount: intent.amount,
      currency: intent.currency,
      reference: intent.reference,
      description: Map.get(attrs, "description"),
      customer_email: Map.get(attrs, "customer_email"),
      customer_phone: Map.get(attrs, "customer_phone"),
      return_url: Map.get(attrs, "return_url"),
      external_reference: Map.get(attrs, "external_reference"),
      card_last_four: Map.get(attrs, "card_last_four"),
      card_scheme: Map.get(attrs, "card_scheme"),
      metadata: Map.get(attrs, "metadata", %{})
    }
  end

  # The intent and the attempt are written together: a captured payment with no
  # transaction behind it is a figure nobody can explain to a customer.
  defp apply_result(%Scope{} = scope, %Intent{} = intent, result, kind) do
    Repo.transaction(fn ->
      with {:ok, updated} <- intent |> Intent.result_changeset(result) |> Repo.update(),
           {:ok, updated} <- maybe_capture(updated, result),
           {:ok, _transaction} <- write_transaction(scope, updated, result, kind, result[:amount]) do
        updated
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  # A gateway that reports a capture has already taken the money, so the
  # captured amount has to follow the status or the two disagree.
  defp maybe_capture(%Intent{} = intent, %{status: :captured}) do
    if Money.zero?(intent.captured_amount) do
      intent |> Intent.capture_changeset(intent.amount) |> Repo.update()
    else
      {:ok, intent}
    end
  end

  defp maybe_capture(intent, _result), do: {:ok, intent}

  defp do_refund(%Scope{} = scope, %Intent{} = intent, amount) do
    with {:ok, provider} <- load_provider(intent),
         {:ok, adapter} <- Gateway.adapter_for(provider),
         {:ok, result} <- adapter.refund(provider, intent.external_id, amount) do
      Repo.transaction(fn ->
        with {:ok, refunded} <- intent |> Intent.refund_changeset(amount) |> Repo.update(),
             {:ok, _transaction} <- write_transaction(scope, refunded, result, "refund", amount) do
          Audit.log(scope, "payment.refunded", refunded,
            entity_type: "payment_intent",
            label: refunded.reference,
            summary: "Refunded #{Decimal.to_string(amount, :normal)}"
          )

          refunded
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end
  end

  defp record_failure(%Intent{} = intent, reason) do
    intent
    |> Intent.result_changeset(%{
      status: :failed,
      external_id: intent.external_id,
      failure_message: inspect(reason)
    })
    |> Repo.update()
  end

  defp write_transaction(%Scope{} = scope, %Intent{} = intent, result, kind, amount) do
    %Transaction{}
    |> Transaction.changeset(%{
      business_id: Scope.business_id(scope) || intent.business_id,
      payment_intent_id: intent.id,
      kind: kind,
      status: transaction_status(result.status),
      amount: amount || Map.get(result, :amount) || intent.amount,
      currency: intent.currency,
      external_id: Map.get(result, :external_id),
      provider_status: Map.get(result, :provider_status),
      failure_code: Map.get(result, :failure_code),
      failure_message: Map.get(result, :failure_message),
      fee_amount: Map.get(result, :fee_amount),
      card_last_four: Map.get(result, :card_last_four),
      card_scheme: Map.get(result, :card_scheme),
      wallet_msisdn: Map.get(result, :wallet_msisdn),
      raw_response: Map.get(result, :raw)
    })
    |> Repo.insert()
  end

  defp transaction_status(:captured), do: "succeeded"
  defp transaction_status(:authorized), do: "succeeded"
  defp transaction_status(:refunded), do: "succeeded"
  defp transaction_status(:failed), do: "failed"
  defp transaction_status(:cancelled), do: "failed"
  defp transaction_status(_other), do: "pending"

  defp kind_for(%{status: :authorized}), do: "authorize"
  defp kind_for(%{status: :captured}), do: "sale"
  defp kind_for(_result), do: "sale"

  # The provider is found from the payload rather than the URL, so a shop
  # cannot be spoofed by a callback aimed at somebody else's endpoint.
  defp provider_for_webhook(provider_name, _raw_body, headers) do
    business_id = Map.get(headers, "x-business-id")

    query =
      Provider
      |> where([p], p.provider == ^provider_name and is_nil(p.deleted_at) and p.is_active)

    query = if business_id, do: where(query, [p], p.business_id == ^business_id), else: query

    case Repo.all(query) do
      [provider] -> {:ok, provider}
      [] -> {:error, :provider_not_configured}
      # More than one shop uses this gateway. Without a business hint the
      # callback cannot be attributed, and guessing would credit the wrong one.
      _many -> {:error, :ambiguous_provider}
    end
  end

  defp verify(adapter, provider, raw_body, headers) do
    case adapter.verify_webhook(provider, raw_body, headers) do
      {:ok, payload} ->
        {:ok, payload}

      {:error, reason} ->
        Logger.warning("rejected #{provider.provider} webhook: #{inspect(reason)}")
        {:error, {:signature_rejected, reason}}
    end
  end

  # Written before it is acted on, and unique per provider — which is what
  # makes a replay a no-op instead of a second capture.
  defp store_event(%Provider{} = provider, provider_name, payload) do
    external_id = event_id(payload)

    attrs = %{
      organization_id: provider.organization_id,
      business_id: provider.business_id,
      provider: provider_name,
      external_id: external_id,
      event_type: Map.get(payload, "type") || Map.get(payload, "event_type") || "unknown",
      signature_verified: true,
      payload: payload
    }

    case %WebhookEvent{} |> WebhookEvent.changeset(attrs) |> Repo.insert() do
      {:ok, event} ->
        {:ok, event}

      {:error, %Ecto.Changeset{errors: errors}} ->
        if Keyword.has_key?(errors, :external_id) do
          {:ok, existing_event(provider_name, external_id)}
        else
          {:error, :event_not_stored}
        end
    end
  end

  defp existing_event(provider_name, external_id) do
    Repo.one(
      from event in WebhookEvent,
        where: event.provider == ^provider_name and event.external_id == ^external_id
    )
  end

  defp process_event(adapter, %Provider{} = provider, event, payload) do
    case adapter.parse_event(payload) do
      {:ok, nil} ->
        # Not our business. Marking it ignored keeps the retry queue clean.
        event |> WebhookEvent.ignored_changeset() |> Repo.update()

      {:ok, parsed} ->
        apply_event(provider, event, parsed)

      {:error, reason} ->
        event |> WebhookEvent.failed_changeset(reason) |> Repo.update()
    end
  end

  defp apply_event(%Provider{} = provider, event, parsed) do
    # A webhook arrives with no user behind it — the gateway is the actor. The
    # scope carries only the tenancy the provider belongs to, which is all the
    # writes below need, and is what stops a callback touching another shop.
    scope = %Scope{
      organization: %{id: provider.organization_id},
      business: %{id: provider.business_id, currency: nil}
    }

    case find_intent(provider, parsed.result) do
      nil ->
        event |> WebhookEvent.failed_changeset(:intent_not_found) |> Repo.update()

      intent ->
        case apply_result(scope, intent, parsed.result, kind_for(parsed.result)) do
          {:ok, updated} -> event |> WebhookEvent.processed_changeset(updated.id) |> Repo.update()
          {:error, reason} -> event |> WebhookEvent.failed_changeset(reason) |> Repo.update()
        end
    end
  end

  defp find_intent(%Provider{} = provider, %{external_id: external_id})
       when is_binary(external_id) do
    Repo.one(
      from intent in Intent,
        where:
          intent.payment_provider_id == ^provider.id and
            (intent.external_id == ^external_id or intent.reference == ^external_id)
    )
  end

  defp find_intent(_provider, _result), do: nil

  defp event_id(payload) do
    Map.get(payload, "id") ||
      Map.get(payload, "pp_TxnRefNo") ||
      Map.get(payload, "orderId") ||
      Ecto.UUID.generate()
  end

  defp currency_of(%Scope{business: %{currency: currency}}) when is_binary(currency), do: currency
  defp currency_of(%Scope{}), do: "PKR"

  defp filter_status(query, nil), do: query
  defp filter_status(query, "open"), do: where(query, [i], i.status in ^Intent.open_statuses())
  defp filter_status(query, status), do: where(query, [i], i.status == ^status)

  defp stringify(attrs) when is_map(attrs) do
    Map.new(attrs, fn {key, value} ->
      {if(is_atom(key), do: Atom.to_string(key), else: key), value}
    end)
  end

  defp stringify(other), do: other
end
