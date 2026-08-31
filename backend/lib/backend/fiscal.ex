defmodule Kaarobar.Fiscal do
  @moduledoc """
  Telling a tax authority about every invoice, and stamping the invoice with
  what came back.

  ## The sale does not wait for the authority

  A revenue authority's endpoint is somebody else's uptime, and a till that
  blocked on it would stop selling every time that service went down. So
  `queue_sale_within/3` writes a `queued` submission inside the checkout
  transaction and returns immediately; the network call happens afterwards, and
  is retried by `process_due/1` until it lands.

  That is a deliberate trade: for a short while a legal sale exists that the
  authority has not been told about. Every regime mandating real-time reporting
  allows a grace period for exactly this, and a shop that cannot sell is worse
  off than one that reports a minute late.

  ## Unless the shop asks for the strict reading

  With `block_on_failure` on, `guard_sale/1` refuses to open a new sale while
  earlier ones are still unreported. That is what a pre-clearance regime
  actually requires, and it is the shop's decision rather than ours, because
  for them the cost of trading unreported is larger than the cost of closing
  the till for an hour.

  It stops new sales rather than unwinding committed ones. A sale that has
  already taken the customer's money and left the shop cannot be made not to
  have happened by an HTTP timeout.

  ## Rejected is not failed

  Rejected means the authority read it and said no — a bad tax number, a total
  that does not add up. Retrying changes nothing and somebody has to fix the
  data, so it is terminal and visible. Failed means the authority did not
  answer, which the next attempt very likely fixes. Collapsing the two either
  hammers a permanently broken invoice or abandons a submission that a minute's
  patience would have completed.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Audit
  alias Kaarobar.Fiscal.Adapter
  alias Kaarobar.Fiscal.Config
  alias Kaarobar.Fiscal.Submission
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Sales.Sale
  alias Kaarobar.Scope

  require Logger

  # ===========================================================================
  # Configuration
  # ===========================================================================

  @doc "The business's fiscal registration, or nil when it does not file."
  @spec config(Scope.t()) :: Config.t() | nil
  def config(%Scope{} = scope) do
    Config
    |> Scoped.for_business(scope)
    |> where([c], is_nil(c.deleted_at))
    |> Repo.one()
  end

  @doc """
  Creates or replaces the business's registration.

  One per business, so this is an upsert rather than a create: a shop does not
  file with two authorities at once, and a second row would silently decide
  which of them wins.
  """
  @spec upsert_config(Scope.t(), map()) :: {:ok, Config.t()} | {:error, Ecto.Changeset.t()}
  def upsert_config(%Scope{} = scope, attrs) do
    existing = config(scope) || %Config{}

    changeset =
      existing
      |> Config.changeset(attrs)
      |> Ecto.Changeset.put_change(:organization_id, Scope.organization_id(scope))
      |> Ecto.Changeset.put_change(:business_id, Scope.business_id(scope))

    with {:ok, config} <- Repo.insert_or_update(changeset) do
      # Credentials are never logged, but the fact that somebody pointed this
      # shop at a different authority certainly is.
      Audit.log(scope, "fiscal.config.saved", config,
        entity_type: "fiscal_config",
        label: config.adapter
      )

      {:ok, config}
    end
  end

  @doc "Switches the business's fiscal reporting off. Past submissions remain."
  @spec disable_config(Scope.t()) :: {:ok, Config.t()} | {:error, term()}
  def disable_config(%Scope{} = scope) do
    case config(scope) do
      nil ->
        {:error, :not_found}

      config ->
        with {:ok, config} <- Repo.update(Config.soft_delete_changeset(config)) do
          Audit.log(scope, "fiscal.config.disabled", config, entity_type: "fiscal_config")
          {:ok, config}
        end
    end
  end

  # ===========================================================================
  # Checkout
  # ===========================================================================

  @doc """
  Refuses a sale when the shop has asked not to trade unreported.

  Only ever says no with `block_on_failure` on. The count in the error is what
  the message at the till should name: "fiscal reporting is behind" tells a
  cashier nothing they can act on, and "eleven invoices are unreported" sends
  them to find a manager.
  """
  @spec guard_sale(Scope.t()) :: :ok | {:error, {:fiscal_backlog, non_neg_integer()}}
  def guard_sale(%Scope{} = scope) do
    config = config(scope)

    if Config.blocking?(config) do
      case backlog_count(scope) do
        0 -> :ok
        count -> {:error, {:fiscal_backlog, count}}
      end
    else
      :ok
    end
  end

  @doc """
  Queues a sale for reporting, inside the caller's transaction.

  Non-transactional on purpose: `Kaarobar.Sales.Checkout` is already in one,
  and Ecto has no nested transactions — a `Repo.rollback` here would abort the
  sale it belongs to.

  Returns `{:ok, nil}` for a business that does not file, which is most of
  them. A caller treating that as an error would make fiscal reporting a
  prerequisite for selling anything anywhere.
  """
  @spec queue_sale_within(Scope.t(), Sale.t(), keyword()) ::
          {:ok, Submission.t() | nil} | {:error, term()}
  def queue_sale_within(%Scope{} = scope, %Sale{} = sale, opts \\ []) do
    config = Keyword.get_lazy(opts, :config, fn -> config(scope) end)

    if Config.reporting?(config) do
      %Submission{}
      |> Submission.changeset(%{
        organization_id: sale.organization_id,
        business_id: sale.business_id,
        branch_id: sale.branch_id,
        sale_id: sale.id,
        adapter: config.adapter,
        kind: Keyword.get(opts, :kind, "invoice")
      })
      |> Repo.insert()
    else
      {:ok, nil}
    end
  end

  @doc """
  Sends a queued submission to the authority.

  Deliberately not wrapped in a transaction. The call takes as long as the
  authority takes, and holding a row lock across somebody else's network is how
  one slow endpoint becomes a stalled database.
  """
  @spec submit(Submission.t()) :: {:ok, Submission.t()} | {:error, term()}
  def submit(%Submission{} = submission) do
    with {:ok, config} <- config_for(submission),
         {:ok, adapter} <- Adapter.for_config(config) do
      document = build_document(submission)
      payload = adapter.build_payload(config, document)

      # The payload is written before the call, not after it. When a
      # submission is disputed months later the question is what the shop
      # actually declared, and an attempt that then timed out has to be able to
      # answer it too.
      case mark_submitting(submission, payload) do
        {:ok, submission} -> dispatch(submission, adapter, config, document)
        {:error, reason} -> {:error, reason}
      end
    end
  end

  @doc """
  Reports a sale now, if it has anything queued.

  What the checkout endpoint calls once its transaction has committed: usually
  the authority answers in a second and the receipt prints with its stamp, and
  the retry job exists for when it does not.
  """
  @spec submit_sale(Scope.t(), Sale.t()) :: {:ok, Submission.t() | nil} | {:error, term()}
  def submit_sale(%Scope{} = scope, %Sale{} = sale) do
    case pending_for_sale(scope, sale) do
      nil -> {:ok, nil}
      submission -> submit(submission)
    end
  end

  @doc """
  Sends every submission that is due, oldest first.

  Runs across tenants, because the retry job is one job and not one per shop.
  Each submission carries its own organization and every write below is keyed
  on the row itself rather than on a scope.
  """
  @spec process_due(non_neg_integer()) :: %{ok: non_neg_integer(), error: non_neg_integer()}
  def process_due(limit \\ 100) do
    now = DateTime.utc_now()

    Submission
    |> where([s], s.status in ^Submission.due_statuses())
    |> where([s], is_nil(s.retry_after) or s.retry_after <= ^now)
    |> order_by([s], asc: s.inserted_at)
    |> limit(^limit)
    |> Repo.all()
    |> Enum.reduce(%{ok: 0, error: 0}, &tally/2)
  end

  # ===========================================================================
  # Reading
  # ===========================================================================

  @doc """
  The business's submissions, newest first.

  ## Options

    * `:status` — one status, or a list of them.
    * `:needs_attention` — only the rejected and the failed, which is the
      screen somebody actually opens this on.
    * `:limit` — defaults to 50.
  """
  @spec list_submissions(Scope.t(), keyword()) :: [Submission.t()]
  def list_submissions(%Scope{} = scope, opts \\ []) do
    Submission
    |> Scoped.for_business(scope)
    |> filter_status(Keyword.get(opts, :status))
    |> filter_attention(Keyword.get(opts, :needs_attention))
    |> order_by([s], desc: s.inserted_at)
    |> limit(^Keyword.get(opts, :limit, 50))
    |> Repo.all()
  end

  @doc "One submission."
  @spec fetch_submission(Scope.t(), Ecto.UUID.t()) :: {:ok, Submission.t()} | {:error, :not_found}
  def fetch_submission(%Scope{} = scope, id) do
    Submission
    |> Scoped.for_business(scope)
    |> where([s], s.id == ^id)
    |> Repo.one()
    |> case do
      nil -> {:error, :not_found}
      submission -> {:ok, submission}
    end
  end

  @doc """
  Puts a parked submission back in the queue.

  Available for rejected ones too, because a rejection is usually fixed by
  correcting the business's registration rather than the invoice — and once
  that is corrected the same invoice will be accepted unchanged.
  """
  @spec retry(Scope.t(), Ecto.UUID.t()) :: {:ok, Submission.t()} | {:error, term()}
  def retry(%Scope{} = scope, id) do
    with {:ok, submission} <- fetch_submission(scope, id) do
      requeue(scope, submission)
    end
  end

  @doc "How many of this business's invoices the authority has not accepted."
  @spec backlog_count(Scope.t()) :: non_neg_integer()
  def backlog_count(%Scope{} = scope) do
    Submission
    |> Scoped.for_business(scope)
    |> where([s], s.status in ~w(queued submitting retrying failed))
    |> Repo.aggregate(:count)
  end

  # ===========================================================================
  # The document
  # ===========================================================================

  @doc """
  Builds the authority-agnostic view of what is being reported.

  Everything comes from the sale's own snapshots rather than from today's
  catalog. What was declared has to keep saying what was declared, even after
  the product is renamed or its tax rate changes.
  """
  @spec build_document(Submission.t()) :: Adapter.document()
  def build_document(%Submission{} = submission) do
    sale =
      Sale
      |> where([s], s.id == ^submission.sale_id)
      |> preload([:customer, items: :taxes])
      |> Repo.one!()

    %{
      kind: submission.kind,
      number: sale.number,
      issued_at: sale.sold_at,
      currency: sale.currency,
      subtotal: sale.subtotal,
      tax_total: sale.tax_total,
      discount_total: total_discount(sale),
      total: sale.total,
      buyer: buyer(sale),
      lines: Enum.map(sale.items, &document_line/1)
    }
  end

  defp document_line(item) do
    %{
      sku: item.sku_snapshot,
      name: item.name_snapshot,
      tax_code: tax_code(item),
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_total: item.discount_total,
      net_total: item.net_total,
      tax_rate: tax_rate(item),
      tax_total: item.tax_total,
      line_total: item.line_total
    }
  end

  # A line may carry several taxes; authorities want one rate per line. The sum
  # of the snapshotted rates is what was actually applied to it, and it is the
  # number a cross-check against the declared tax total has to reproduce.
  defp tax_rate(%{taxes: taxes}) when is_list(taxes) do
    Enum.reduce(taxes, Decimal.new(0), fn tax, acc ->
      Decimal.add(acc, tax.rate_snapshot || Decimal.new(0))
    end)
  end

  defp tax_rate(_item), do: Decimal.new(0)

  defp tax_code(%{taxes: [%{label_snapshot: label} | _rest]}) when is_binary(label), do: label
  defp tax_code(_item), do: nil

  defp total_discount(%Sale{} = sale) do
    Decimal.add(sale.discount_total || Decimal.new(0), sale.order_discount || Decimal.new(0))
  end

  defp buyer(%Sale{customer: %{} = customer}) do
    %{
      name: customer.name,
      tax_number: customer.tax_number,
      national_id: nil,
      phone: customer.phone,
      address: customer.address_line1
    }
  end

  defp buyer(%Sale{}), do: nil

  # ===========================================================================
  # Internals
  # ===========================================================================

  defp dispatch(submission, adapter, config, document) do
    case adapter.submit(config, document) do
      {:accepted, result} -> accept(submission, result)
      {:rejected, rejection} -> reject(submission, rejection)
      {:failed, reason} -> fail(submission, reason)
    end
  end

  # The stamp is written to the submission and copied onto the sale in one
  # transaction. A sale carrying a number whose submission says it was never
  # accepted — or the reverse — is the state nobody can reconcile afterwards.
  defp accept(submission, result) do
    Repo.transaction(fn ->
      case Repo.update(Submission.accepted_changeset(submission, result)) do
        {:ok, accepted} ->
          stamp_sale(accepted)
          accepted

        {:error, changeset} ->
          Repo.rollback(changeset)
      end
    end)
  end

  defp reject(submission, rejection) do
    Repo.transaction(fn ->
      case Repo.update(Submission.rejected_changeset(submission, rejection)) do
        {:ok, rejected} ->
          set_sale_status(rejected, "rejected")
          rejected

        {:error, changeset} ->
          Repo.rollback(changeset)
      end
    end)
  end

  defp fail(submission, reason) do
    with {:ok, failed} <- Repo.update(Submission.failed_changeset(submission, reason)) do
      if failed.status == "failed", do: set_sale_status(failed, "failed")
      {:ok, failed}
    end
  end

  defp mark_submitting(submission, payload),
    do: Repo.update(Submission.submitting_changeset(submission, payload))

  defp requeue(_scope, %Submission{status: "accepted"}), do: {:error, :already_accepted}

  defp requeue(scope, %Submission{} = submission) do
    # The attempt count is reset: a person has looked at this and changed
    # something, so the backoff earned by the old data is no longer a useful
    # measure of how likely the next attempt is to work.
    submission
    |> Ecto.Changeset.change(%{status: "queued", attempts: 0, retry_after: nil})
    |> Repo.update()
    |> tap_audit(scope)
  end

  defp stamp_sale(%Submission{kind: "invoice"} = submission) do
    Sale
    |> where([s], s.id == ^submission.sale_id)
    |> Repo.update_all(
      set: [
        fiscal_number: submission.fiscal_number,
        fiscal_qr_payload: submission.qr_payload,
        fiscal_status: "accepted"
      ]
    )
  end

  # A void or a refund is reported against the sale but does not restamp it:
  # the invoice keeps the number it was issued under, which is the number the
  # credit note has to reference.
  defp stamp_sale(%Submission{}), do: :ok

  defp set_sale_status(%Submission{kind: "invoice"} = submission, status) do
    Sale
    |> where([s], s.id == ^submission.sale_id)
    |> Repo.update_all(set: [fiscal_status: status])
  end

  defp set_sale_status(%Submission{}, _status), do: :ok

  defp config_for(%Submission{} = submission) do
    Config
    |> where([c], c.business_id == ^submission.business_id and is_nil(c.deleted_at))
    |> Repo.one()
    |> case do
      nil -> {:error, :no_fiscal_config}
      config -> {:ok, config}
    end
  end

  defp pending_for_sale(%Scope{} = scope, %Sale{} = sale) do
    Submission
    |> Scoped.for_business(scope)
    |> where([s], s.sale_id == ^sale.id)
    |> where([s], s.status in ^Submission.due_statuses())
    |> order_by([s], asc: s.inserted_at)
    |> limit(1)
    |> Repo.one()
  end

  defp tally(submission, acc) do
    case submit(submission) do
      {:ok, _submission} ->
        %{acc | ok: acc.ok + 1}

      {:error, reason} ->
        Logger.warning("fiscal submission #{submission.id} not sent: #{inspect(reason)}")
        %{acc | error: acc.error + 1}
    end
  end

  defp filter_status(query, nil), do: query
  defp filter_status(query, status) when is_binary(status), do: filter_status(query, [status])

  defp filter_status(query, statuses) when is_list(statuses),
    do: where(query, [s], s.status in ^statuses)

  defp filter_attention(query, true), do: where(query, [s], s.status in ~w(rejected failed))
  defp filter_attention(query, _other), do: query

  defp tap_audit({:ok, submission} = result, scope) do
    Audit.log(scope, "fiscal.submission.retried", submission,
      entity_type: "fiscal_submission",
      label: submission.id
    )

    result
  end

  defp tap_audit(result, _scope), do: result
end
