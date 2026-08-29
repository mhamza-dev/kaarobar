defmodule Kaarobar.Sales do
  @moduledoc """
  Sales, the open tickets that become them, and everything that undoes one.

  `Kaarobar.Sales.Checkout` writes sales; this module reads them and reverses
  them. The split is deliberate: creating a sale is one long transaction with a
  single entry point, and mixing it in with listing and voiding would blur the
  one boundary in the system that most needs to stay sharp.

  ## Voiding and refunding are different things

  A **void** cancels a whole sale that should never have been rung — the wrong
  button, a customer who changed their mind before leaving. It returns all the
  stock, reverses every tender, and takes the sale out of the day's takings. It
  requires a reason, because a void is the one action that erases a whole
  transaction, and an unexplained one is exactly what somebody covering a
  shortfall would leave behind.

  A **return** brings goods back after the fact. The original sale stays in the
  takings, and the return sits beside it as its own document. Part of a sale
  may come back; the shop keeps the rest of the money and the record of what
  was actually sold.

  Neither ever edits the original. That is not fastidiousness — a sale that can
  be quietly amended is one an auditor cannot rely on and a shopkeeper cannot
  prove anything with.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Audit
  alias Kaarobar.Catalog
  alias Kaarobar.Catalog.Modifier
  alias Kaarobar.Catalog.Product
  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Customers
  alias Kaarobar.Inventory.Ledger
  alias Kaarobar.Money
  alias Kaarobar.Registers
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Sales.Order
  alias Kaarobar.Sales.OrderItem
  alias Kaarobar.Sales.OrderItemModifier
  alias Kaarobar.Sales.Payment
  alias Kaarobar.Sales.PaymentRefund
  alias Kaarobar.Sales.RefundRequest
  alias Kaarobar.Sales.RefundRequestItem
  alias Kaarobar.Sales.Sale
  alias Kaarobar.Sales.SaleItem
  alias Kaarobar.Sales.SaleReturn
  alias Kaarobar.Sales.SaleReturnItem
  alias Kaarobar.Scope
  alias Kaarobar.Sequences

  @sale_preloads [
    :customer,
    :register,
    :cashier,
    :payments,
    items: [:taxes, :modifiers, :variant]
  ]

  # ===========================================================================
  # Reading sales
  # ===========================================================================

  @doc """
  Builds the sale query, filtered and scoped.

  A cashier with only `sale:view` sees their own sales; `sale:view_all` widens
  it to the branch. The narrowing happens here rather than in the controller so
  no endpoint can forget it.
  """
  @spec query(Scope.t(), map()) :: Ecto.Query.t()
  def query(%Scope{} = scope, filters \\ %{}) do
    Sale
    |> Scoped.for_business(scope)
    |> Scoped.within_branches(scope)
    |> restrict_to_own(scope)
    |> apply_sale_filters(filters)
  end

  @doc "Lists sales, most recent first."
  @spec list_sales(Scope.t(), map()) :: [Sale.t()]
  def list_sales(%Scope{} = scope, filters \\ %{}) do
    scope
    |> query(filters)
    |> order_by([sale], desc: sale.sold_at, desc: sale.id)
    |> preload([:customer, :register, :cashier])
    |> Repo.all()
  end

  @doc "Fetches one sale with everything a receipt needs."
  @spec fetch_sale(Scope.t(), Ecto.UUID.t()) :: {:ok, Sale.t()} | {:error, :not_found}
  def fetch_sale(%Scope{} = scope, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      scope
      |> query(%{})
      |> where([sale], sale.id == ^id)
      |> preload(^@sale_preloads)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        sale -> {:ok, sale}
      end
    else
      {:error, :not_found}
    end
  end

  @doc """
  Finds a sale by the number the customer is reading off a receipt.

  Not scoped to the caller's own sales: someone answering a query at the
  counter needs to find the sale whoever rang it.
  """
  @spec fetch_sale_by_number(Scope.t(), String.t()) :: {:ok, Sale.t()} | {:error, :not_found}
  def fetch_sale_by_number(%Scope{} = scope, number) do
    Sale
    |> Scoped.for_business(scope)
    |> where([sale], sale.number == ^number)
    |> preload(^@sale_preloads)
    |> Repo.one()
    |> case do
      nil -> {:error, :not_found}
      sale -> {:ok, sale}
    end
  end

  # ===========================================================================
  # Voiding
  # ===========================================================================

  @doc """
  Voids a whole sale.

  Stock goes back, every tender is reversed, any credit is taken off the
  customer's balance, and the shift's totals are reduced. All in one
  transaction, because a half-voided sale is worse than an unvoided one.

  Refused once anything has been refunded: two reversals of the same money is
  how a shop gives away twice what it took. Refund the rest instead.
  """
  @spec void_sale(Scope.t(), Sale.t(), String.t()) :: {:ok, Sale.t()} | {:error, term()}
  def void_sale(%Scope{} = scope, %Sale{} = sale, reason) do
    cond do
      sale.status == "voided" ->
        {:error, :already_voided}

      Money.positive?(sale.refunded_total) ->
        {:error, :already_refunded}

      true ->
        do_void(scope, sale, reason)
    end
  end

  defp do_void(%Scope{} = scope, %Sale{} = sale, reason) do
    Repo.transaction(fn ->
      loaded = Repo.preload(sale, [:payments, items: [variant: :product]])

      void = Sale.void_changeset(loaded, Scope.user_id(scope), reason)

      with {:ok, _moves} <- return_stock(scope, loaded, void_moves(loaded)),
           {:ok, voided} <- Repo.update(void),
           :ok <- reverse_payments(scope, loaded),
           :ok <- reverse_credit(scope, loaded),
           {:ok, _shift} <- reverse_shift(loaded) do
        Audit.log(scope, "sale.voided", voided,
          entity_type: "sale",
          label: voided.number,
          summary: "Voided #{Decimal.to_string(voided.total, :normal)}: #{reason}"
        )

        voided
      else
        {:error, failure} -> Repo.rollback(failure)
      end
    end)
  end

  defp void_moves(%Sale{} = sale) do
    sale.items
    |> Enum.filter(&stockable?/1)
    |> Enum.map(fn item ->
      %{
        variant_id: item.variant_id,
        branch_id: sale.branch_id,
        kind: "sale_return",
        quantity: item.quantity,
        batch_id: item.batch_id,
        reference_type: "sale_void",
        reference_id: sale.id,
        reason: "Void #{sale.number}"
      }
    end)
  end

  defp reverse_payments(%Scope{} = scope, %Sale{} = sale) do
    Enum.reduce_while(sale.payments, :ok, fn payment, :ok ->
      if Payment.deferred?(payment) do
        {:cont, :ok}
      else
        case write_payment_refund(scope, sale, payment, payment.amount, nil) do
          {:ok, _refund} -> {:cont, :ok}
          {:error, failure} -> {:halt, {:error, failure}}
        end
      end
    end)
  end

  defp reverse_credit(%Scope{} = scope, %Sale{customer_id: customer_id} = sale)
       when not is_nil(customer_id) do
    amount = credit_taken(sale)

    if Money.zero?(amount) do
      :ok
    else
      case Customers.record_ledger_entry(scope, customer_id, %{
             kind: "refund",
             amount: Decimal.negate(amount),
             branch_id: sale.branch_id,
             reference_type: "sale_void",
             reference_id: sale.id,
             note: "Void #{sale.number}"
           }) do
        {:ok, _entry} -> :ok
        {:error, failure} -> {:error, failure}
      end
    end
  end

  defp reverse_credit(_scope, %Sale{}), do: :ok

  defp credit_taken(%Sale{payments: payments}) when is_list(payments) do
    payments
    |> Enum.filter(&Payment.deferred?/1)
    |> Enum.map(& &1.amount)
    |> Money.sum()
  end

  defp credit_taken(%Sale{}), do: Money.zero()

  defp reverse_shift(%Sale{} = sale) do
    tenders = Enum.map(sale.payments, &{&1.method, &1.amount})
    Registers.apply_return(sale.shift_id, sale.total, tenders)
  end

  # ===========================================================================
  # Refund requests
  # ===========================================================================

  @doc """
  Raises a request to give money back.

  The cashier who made the mistake should not be the one who approves undoing
  it, so this and `approve_refund_request/3` are separate permissions. A
  one-person shop holds both and the request approves in the same breath; a
  shop with a supervisor gets a queue and a record of who authorised what.
  """
  @spec create_refund_request(Scope.t(), Sale.t(), map()) ::
          {:ok, RefundRequest.t()} | {:error, term()}
  def create_refund_request(%Scope{} = scope, %Sale{} = sale, attrs) do
    Repo.transaction(fn ->
      items = attrs |> Map.get("items", Map.get(attrs, :items, [])) |> Enum.map(&stringify/1)

      with :ok <- validate_return_items(scope, sale, items),
           {:ok, number} <- Sequences.next(scope, "refund_request"),
           {:ok, request} <- insert_refund_request(scope, sale, attrs, number),
           :ok <- insert_refund_request_items(request, items) do
        Audit.log(scope, "refund_request.created", request,
          entity_type: "refund_request",
          label: request.number,
          summary: "Requested against #{sale.number}: #{request.reason}"
        )

        Repo.preload(request, :items)
      else
        {:error, failure} -> Repo.rollback(failure)
      end
    end)
  end

  @doc "Lists refund requests, newest first."
  @spec list_refund_requests(Scope.t(), map()) :: [RefundRequest.t()]
  def list_refund_requests(%Scope{} = scope, filters \\ %{}) do
    RefundRequest
    |> Scoped.for_business(scope)
    |> Scoped.within_branches(scope)
    |> filter_status(filters)
    |> order_by([request], desc: request.requested_at)
    |> preload([:items, :sale, :requested_by, :reviewed_by])
    |> Repo.all()
  end

  @doc "Fetches a refund request."
  @spec fetch_refund_request(Scope.t(), Ecto.UUID.t()) ::
          {:ok, RefundRequest.t()} | {:error, :not_found}
  def fetch_refund_request(%Scope{} = scope, id) do
    RefundRequest
    |> Scoped.for_business(scope)
    |> where([request], request.id == ^id)
    |> preload([:items, :sale, :requested_by, :reviewed_by])
    |> Repo.one()
    |> case do
      nil -> {:error, :not_found}
      request -> {:ok, request}
    end
  end

  @doc "Approves a request, so the money may be paid out."
  @spec approve_refund_request(Scope.t(), RefundRequest.t(), String.t() | nil) ::
          {:ok, RefundRequest.t()} | {:error, term()}
  def approve_refund_request(%Scope{} = scope, %RefundRequest{} = request, note \\ nil),
    do: review_request(scope, request, "approved", note)

  @doc "Turns a request down. A note is required, because the customer will ask."
  @spec reject_refund_request(Scope.t(), RefundRequest.t(), String.t()) ::
          {:ok, RefundRequest.t()} | {:error, term()}
  def reject_refund_request(%Scope{} = scope, %RefundRequest{} = request, note),
    do: review_request(scope, request, "rejected", note)

  defp review_request(%Scope{} = scope, %RefundRequest{} = request, status, note) do
    if RefundRequest.pending?(request) do
      changeset = RefundRequest.review_changeset(request, status, Scope.user_id(scope), note)

      with {:ok, reviewed} <- Repo.update(changeset) do
        Audit.log(scope, "refund_request.#{status}", reviewed,
          entity_type: "refund_request",
          label: reviewed.number,
          summary: note
        )

        {:ok, reviewed}
      end
    else
      {:error, :not_pending}
    end
  end

  # ===========================================================================
  # Returns
  # ===========================================================================

  @doc """
  Takes goods back and gives money back.

  ## Parameters

    * `"items"` — `[%{"sale_item_id", "quantity", "restock", "reason"}]`.
      `restock` defaults to true; a faulty item set to false is written off
      instead, so the count stays true and the loss stays visible.
    * `"refunds"` — how the money goes back, `[%{"payment_id", "amount"}]`.
      Omitted, it is allocated across the original tenders in the order they
      were taken.
    * `"refund_request_id"` — the approval this return is being paid against.
    * `"shift_id"` — the drawer the cash comes out of.

  Every figure is prorated from the sale line rather than recomputed. Returning
  three of five brings back three fifths of that line's tax and cost, whatever
  promotions applied at the time — recomputing at today's prices would refund
  an amount the customer never paid.
  """
  @spec process_return(Scope.t(), Sale.t(), map()) :: {:ok, SaleReturn.t()} | {:error, term()}
  def process_return(%Scope{} = scope, %Sale{} = sale, params) do
    params = stringify(params)
    items = params |> Map.get("items", []) |> Enum.map(&stringify/1)

    if sale.status == "voided" do
      {:error, :sale_voided}
    else
      commit_return(scope, sale, params, items)
    end
  end

  defp commit_return(%Scope{} = scope, %Sale{} = sale, params, items) do
    Repo.transaction(fn ->
      loaded = Repo.preload(sale, [:payments, items: [variant: :product]])

      with :ok <- validate_return_items(scope, loaded, items),
           {:ok, lines} <- build_return_lines(loaded, items),
           {:ok, number} <- Sequences.next(scope, "sale_return"),
           {:ok, record} <- insert_return(scope, loaded, params, lines, number),
           :ok <- insert_return_items(scope, record, lines),
           {:ok, _moves} <- return_stock(scope, loaded, return_moves(record, lines)),
           :ok <- mark_lines_refunded(lines),
           {:ok, tenders} <- refund_money(scope, loaded, record, params),
           :ok <- refund_credit(scope, loaded, record, tenders),
           {:ok, _sale} <- record_sale_refund(loaded, record),
           {:ok, _shift} <- Registers.apply_return(record.shift_id, record.total, tenders) do
        Audit.log(scope, "sale.returned", record,
          entity_type: "sale_return",
          label: record.number,
          summary:
            "Returned #{Decimal.to_string(record.total, :normal)} against #{loaded.number}"
        )

        Repo.preload(record, :items)
      else
        {:error, failure} -> Repo.rollback(failure)
      end
    end)
  end

  # Nothing is prorated until it is known the quantities are possible. A return
  # for more than was sold is a data-entry slip at best, and refunding it would
  # hand out money that was never taken.
  defp validate_return_items(_scope, _sale, []), do: {:error, :no_items}

  defp validate_return_items(_scope, %Sale{} = sale, items) do
    sale_items = Map.new(loaded_items(sale), &{&1.id, &1})

    Enum.reduce_while(items, :ok, fn input, :ok ->
      sale_item = Map.get(sale_items, Map.get(input, "sale_item_id"))
      quantity = to_quantity(Map.get(input, "quantity"))

      cond do
        is_nil(sale_item) ->
          {:halt, {:error, {:sale_item_not_found, Map.get(input, "sale_item_id")}}}

        not Money.positive?(quantity) ->
          {:halt, {:error, {:invalid_quantity, sale_item.id}}}

        Decimal.compare(quantity, SaleItem.refundable_quantity(sale_item)) == :gt ->
          {:halt, {:error, {:exceeds_refundable, sale_item.id}}}

        true ->
          {:cont, :ok}
      end
    end)
  end

  defp loaded_items(%Sale{items: items}) when is_list(items), do: items

  defp loaded_items(%Sale{} = sale),
    do: sale |> Repo.preload(items: [variant: :product]) |> Map.fetch!(:items)

  defp build_return_lines(%Sale{} = sale, items) do
    sale_items = Map.new(loaded_items(sale), &{&1.id, &1})

    lines =
      items
      |> Enum.with_index()
      |> Enum.map(fn {input, position} ->
        sale_item = Map.fetch!(sale_items, Map.get(input, "sale_item_id"))
        quantity = to_quantity(Map.get(input, "quantity"))
        share = SaleItem.proportion_of(sale_item, quantity)

        %{
          sale_item: sale_item,
          quantity: quantity,
          restock: Map.get(input, "restock", true) != false,
          reason: Map.get(input, "reason"),
          position: position,
          tax_total: sale_item.tax_total |> Money.mult(share) |> Money.round(sale.currency),
          line_total: sale_item.line_total |> Money.mult(share) |> Money.round(sale.currency),
          net_total: sale_item.net_total |> Money.mult(share) |> Money.round(sale.currency),
          cost: sale_item.cost_snapshot |> Money.mult(share) |> Money.round(sale.currency)
        }
      end)

    {:ok, lines}
  end

  defp insert_return(%Scope{} = scope, %Sale{} = sale, params, lines, number) do
    attrs = %{
      organization_id: sale.organization_id,
      business_id: sale.business_id,
      branch_id: sale.branch_id,
      register_id: Map.get(params, "register_id") || sale.register_id,
      shift_id: Map.get(params, "shift_id") || sale.shift_id,
      sale_id: sale.id,
      customer_id: sale.customer_id,
      refund_request_id: Map.get(params, "refund_request_id"),
      number: number,
      reason: Map.get(params, "reason"),
      subtotal: lines |> Enum.map(& &1.net_total) |> Money.sum(),
      tax_total: lines |> Enum.map(& &1.tax_total) |> Money.sum(),
      total: lines |> Enum.map(& &1.line_total) |> Money.sum(),
      cost_total: lines |> Enum.map(& &1.cost) |> Money.sum(),
      processed_by_id: Scope.user_id(scope),
      processed_by_label: scope.user && scope.user.name,
      returned_at: DateTime.utc_now(),
      notes: Map.get(params, "notes")
    }

    %SaleReturn{} |> SaleReturn.changeset(attrs) |> Repo.insert()
  end

  defp insert_return_items(%Scope{} = scope, %SaleReturn{} = record, lines) do
    Enum.reduce_while(lines, :ok, fn line, :ok ->
      attrs = %{
        business_id: Scope.business_id(scope),
        sale_return_id: record.id,
        sale_item_id: line.sale_item.id,
        variant_id: line.sale_item.variant_id,
        batch_id: line.sale_item.batch_id,
        name_snapshot: line.sale_item.name_snapshot,
        quantity: line.quantity,
        unit_price: line.sale_item.unit_price,
        tax_total: line.tax_total,
        line_total: line.line_total,
        cost_snapshot: line.cost,
        restock: line.restock,
        reason: line.reason,
        position: line.position
      }

      case %SaleReturnItem{} |> SaleReturnItem.changeset(attrs) |> Repo.insert() do
        {:ok, _item} -> {:cont, :ok}
        {:error, failure} -> {:halt, {:error, failure}}
      end
    end)
  end

  # Everything comes back into stock first, and anything not going back on the
  # shelf is then written off. Two moves rather than none, because the shop
  # needs both numbers: what was returned, and what it lost.
  defp return_moves(%SaleReturn{} = record, lines) do
    Enum.flat_map(lines, fn line ->
      if stockable?(line.sale_item) do
        back = %{
          variant_id: line.sale_item.variant_id,
          branch_id: record.branch_id,
          kind: "sale_return",
          quantity: line.quantity,
          batch_id: line.sale_item.batch_id,
          reference_type: "sale_return",
          reference_id: record.id,
          reason: "Return #{record.number}"
        }

        if line.restock do
          [back]
        else
          [back, %{back | kind: "wastage", reason: line.reason || "Returned faulty"}]
        end
      else
        []
      end
    end)
  end

  defp return_stock(_scope, _sale, []), do: {:ok, []}

  defp return_stock(%Scope{} = scope, _sale, moves), do: Ledger.post_many_within(scope, moves)

  defp mark_lines_refunded(lines) do
    Enum.reduce_while(lines, :ok, fn line, :ok ->
      case line.sale_item |> SaleItem.refund_changeset(line.quantity) |> Repo.update() do
        {:ok, _item} -> {:cont, :ok}
        {:error, failure} -> {:halt, {:error, failure}}
      end
    end)
  end

  # Money goes back the way it came: a card refund to the card, cash to the
  # drawer. That is what the customer expects and what reconciles against the
  # card terminal's own settlement — refunding a card payment in cash makes
  # both totals wrong and hands out money that is hard to trace.
  defp refund_money(%Scope{} = scope, %Sale{} = sale, %SaleReturn{} = record, params) do
    explicit = params |> Map.get("refunds", []) |> Enum.map(&stringify/1)
    settleable = Enum.reject(sale.payments, &Payment.deferred?/1)
    plan = refund_plan(settleable, record.total, explicit)

    Enum.reduce_while(plan, {:ok, []}, fn {payment, amount}, {:ok, acc} ->
      case write_payment_refund(scope, sale, payment, amount, record.id) do
        {:ok, _refund} -> {:cont, {:ok, [{payment.method, amount} | acc]}}
        {:error, failure} -> {:halt, {:error, failure}}
      end
    end)
  end

  defp refund_plan(payments, total, []) do
    payments
    |> Enum.reduce({[], total}, fn payment, {acc, remaining} ->
      take = Money.min(remaining, Payment.refundable_amount(payment))

      if Money.positive?(take) do
        {[{payment, take} | acc], Money.sub(remaining, take)}
      else
        {acc, remaining}
      end
    end)
    |> elem(0)
    |> Enum.reverse()
  end

  defp refund_plan(payments, _total, explicit) do
    index = Map.new(payments, &{&1.id, &1})

    explicit
    |> Enum.map(fn entry ->
      {Map.get(index, Map.get(entry, "payment_id")), to_quantity(Map.get(entry, "amount"))}
    end)
    |> Enum.reject(fn {payment, amount} -> is_nil(payment) or not Money.positive?(amount) end)
  end

  defp write_payment_refund(%Scope{} = scope, %Sale{} = sale, %Payment{} = payment, amount, ref) do
    attrs = %{
      business_id: sale.business_id,
      payment_id: payment.id,
      sale_return_id: ref,
      shift_id: sale.shift_id,
      method: payment.method,
      amount: amount,
      actor_user_id: Scope.user_id(scope),
      occurred_at: DateTime.utc_now()
    }

    with {:ok, refund} <- %PaymentRefund{} |> PaymentRefund.changeset(attrs) |> Repo.insert(),
         {:ok, _payment} <- payment |> Payment.refund_changeset(amount) |> Repo.update() do
      {:ok, refund}
    end
  end

  # A sale paid on account is refunded by reducing the debt, not by handing
  # over money that was never taken.
  #
  # The credit share is whatever the real tenders could not cover. On a sale
  # settled half in cash and half on account, refunding the whole amount
  # against the ledger as well as the drawer would hand the customer their
  # money twice.
  defp refund_credit(%Scope{} = scope, %Sale{customer_id: customer_id} = sale, record, tenders)
       when not is_nil(customer_id) do
    returned_in_money = tenders |> Enum.map(&elem(&1, 1)) |> Money.sum()

    outstanding =
      record.total
      |> Money.sub(returned_in_money)
      |> Money.clamp_non_negative()
      |> Money.min(credit_taken(sale))

    if Money.zero?(outstanding) do
      :ok
    else
      case Customers.record_ledger_entry(scope, customer_id, %{
             kind: "credit_note",
             amount: Decimal.negate(outstanding),
             branch_id: sale.branch_id,
             reference_type: "sale_return",
             reference_id: record.id,
             note: "Return #{record.number}"
           }) do
        {:ok, _entry} -> :ok
        {:error, failure} -> {:error, failure}
      end
    end
  end

  defp refund_credit(_scope, %Sale{}, _record, _tenders), do: :ok

  defp record_sale_refund(%Sale{} = sale, %SaleReturn{} = record),
    do: sale |> Sale.refund_changeset(record.total) |> Repo.update()

  @doc "Returns taken against a sale, newest first."
  @spec list_returns(Scope.t(), map()) :: [SaleReturn.t()]
  def list_returns(%Scope{} = scope, filters \\ %{}) do
    SaleReturn
    |> Scoped.for_business(scope)
    |> Scoped.within_branches(scope)
    |> filter_sale(filters)
    |> order_by([record], desc: record.returned_at)
    |> preload([:items, :sale, :customer])
    |> Repo.all()
  end

  # ===========================================================================
  # Orders — the open ticket
  # ===========================================================================

  @doc """
  Opens a ticket.

  Items chosen, money not yet taken: a restaurant table's running tab, a salon
  client's visit, a retail sale parked while the customer fetches their wallet.
  """
  @spec create_order(Scope.t(), map()) :: {:ok, Order.t()} | {:error, term()}
  def create_order(%Scope{} = scope, attrs) do
    attrs = stringify(attrs)

    Repo.transaction(fn ->
      branch_id = Map.get(attrs, "branch_id") || Scope.branch_id(scope)

      with {:ok, number} <- Sequences.next(scope, "order"),
           {:ok, order} <- insert_order(scope, attrs, branch_id, number),
           :ok <- add_lines(scope, order, Map.get(attrs, "items", [])) do
        Audit.log(scope, "order.created", order, entity_type: "order", label: order.number)
        reload_order(scope, order.id)
      else
        {:error, failure} -> Repo.rollback(failure)
      end
    end)
  end

  @doc "Lists open tickets at the branches the scope can see."
  @spec list_orders(Scope.t(), map()) :: [Order.t()]
  def list_orders(%Scope{} = scope, filters \\ %{}) do
    Order
    |> Scoped.for_business(scope)
    |> Scoped.within_branches(scope)
    |> filter_status(filters)
    |> order_by([order], desc: order.opened_at)
    |> preload([:customer, items: :modifiers])
    |> Repo.all()
  end

  @doc "Fetches a ticket with its lines."
  @spec fetch_order(Scope.t(), Ecto.UUID.t()) :: {:ok, Order.t()} | {:error, :not_found}
  def fetch_order(%Scope{} = scope, id) do
    case reload_order(scope, id) do
      nil -> {:error, :not_found}
      order -> {:ok, order}
    end
  end

  @doc """
  Adds lines to an open ticket.

  Refused once the ticket is billed: the sale is a financial record, and adding
  to it after the fact is how a table ends up eating food nobody paid for.
  """
  @spec add_order_items(Scope.t(), Order.t(), [map()]) :: {:ok, Order.t()} | {:error, term()}
  def add_order_items(%Scope{} = scope, %Order{} = order, items) do
    if Order.live?(order) do
      Repo.transaction(fn ->
        case add_lines(scope, order, items) do
          :ok -> reload_order(scope, order.id)
          {:error, failure} -> Repo.rollback(failure)
        end
      end)
    else
      {:error, :order_closed}
    end
  end

  @doc "Removes a line that has not been paid for."
  @spec remove_order_item(Scope.t(), Order.t(), Ecto.UUID.t()) ::
          {:ok, Order.t()} | {:error, term()}
  def remove_order_item(%Scope{} = scope, %Order{} = order, item_id) do
    item =
      OrderItem
      |> where([item], item.id == ^item_id and item.order_id == ^order.id)
      |> Repo.one()

    cond do
      is_nil(item) -> {:error, :not_found}
      Money.positive?(item.billed_quantity) -> {:error, :already_billed}
      true -> delete_order_item(scope, order, item)
    end
  end

  defp delete_order_item(%Scope{} = scope, %Order{} = order, %OrderItem{} = item) do
    Repo.transaction(fn ->
      {:ok, _deleted} = Repo.delete(item)
      refresh_order_totals(scope, order.id)
      reload_order(scope, order.id)
    end)
  end

  @doc "Parks a ticket so the till is free for the next customer."
  @spec hold_order(Scope.t(), Order.t()) :: {:ok, Order.t()} | {:error, term()}
  def hold_order(%Scope{} = _scope, %Order{} = order),
    do: order |> Order.hold_changeset() |> Repo.update()

  @doc "Brings a parked ticket back to the till."
  @spec resume_order(Scope.t(), Order.t()) :: {:ok, Order.t()} | {:error, term()}
  def resume_order(%Scope{} = _scope, %Order{} = order),
    do: order |> Order.resume_changeset() |> Repo.update()

  @doc """
  Abandons a ticket. A reason is required, because someone will ask.

  Refused once any part of it has been billed: the sale exists, and a cancelled
  ticket beside a real sale is a contradiction nobody can reconcile.
  """
  @spec cancel_order(Scope.t(), Order.t(), String.t()) :: {:ok, Order.t()} | {:error, term()}
  def cancel_order(%Scope{} = scope, %Order{} = order, reason) do
    loaded = Repo.preload(order, :items)

    if Enum.any?(loaded.items, &Money.positive?(&1.billed_quantity)) do
      {:error, :already_billed}
    else
      with {:ok, cancelled} <- loaded |> Order.cancel_changeset(reason) |> Repo.update() do
        Audit.log(scope, "order.cancelled", cancelled,
          entity_type: "order",
          label: cancelled.number,
          summary: reason
        )

        {:ok, cancelled}
      end
    end
  end

  # ===========================================================================
  # Internal
  # ===========================================================================

  defp insert_order(%Scope{} = scope, attrs, branch_id, number) do
    %Order{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope)
    }
    |> Order.open_changeset(
      Map.merge(attrs, %{
        "branch_id" => branch_id,
        "number" => number,
        "organization_id" => Scope.organization_id(scope),
        "business_id" => Scope.business_id(scope),
        "opened_by_id" => Scope.user_id(scope)
      })
    )
    |> Repo.insert()
  end

  defp add_lines(_scope, _order, items) when items in [nil, []], do: :ok

  defp add_lines(%Scope{} = scope, %Order{} = order, items) do
    position = next_position(order.id)

    result =
      items
      |> Enum.map(&stringify/1)
      |> Enum.with_index(position)
      |> Enum.reduce_while(:ok, fn {input, index}, :ok ->
        case add_line(scope, order, input, index) do
          :ok -> {:cont, :ok}
          {:error, failure} -> {:halt, {:error, failure}}
        end
      end)

    with :ok <- result do
      refresh_order_totals(scope, order.id)
    end
  end

  defp add_line(%Scope{} = scope, %Order{} = order, input, position) do
    with {:ok, variant} <- Catalog.fetch_variant(scope, Map.get(input, "variant_id")) do
      modifiers = fetch_modifiers(scope, Map.get(input, "modifier_ids", []))
      quantity = to_quantity(Map.get(input, "quantity", 1))
      unit_price = unit_price_for(variant, input)

      attrs = %{
        business_id: Scope.business_id(scope),
        order_id: order.id,
        variant_id: variant.id,
        name_snapshot: variant_label(variant),
        quantity: quantity,
        unit_price: unit_price,
        line_total: line_total(unit_price, quantity, modifiers),
        seat_number: Map.get(input, "seat_number"),
        position: position,
        note: Map.get(input, "note")
      }

      with {:ok, item} <- %OrderItem{} |> OrderItem.changeset(attrs) |> Repo.insert() do
        attach_modifiers(item, modifiers)
      end
    end
  end

  defp attach_modifiers(%OrderItem{} = item, modifiers) do
    Enum.reduce_while(modifiers, :ok, fn modifier, :ok ->
      attrs = %{
        order_item_id: item.id,
        modifier_id: modifier.id,
        name_snapshot: modifier.name,
        price_delta: modifier.price_delta
      }

      case %OrderItemModifier{} |> OrderItemModifier.changeset(attrs) |> Repo.insert() do
        {:ok, _line} -> {:cont, :ok}
        {:error, failure} -> {:halt, {:error, failure}}
      end
    end)
  end

  defp fetch_modifiers(_scope, ids) when ids in [nil, []], do: []

  defp fetch_modifiers(%Scope{} = scope, ids) when is_list(ids) do
    Modifier
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> where([modifier], modifier.id in ^ids)
    |> Repo.all()
  end

  defp fetch_modifiers(_scope, _ids), do: []

  # The ticket's own price is indicative — checkout prices again from the
  # catalog, because a promotion may have started or ended since it opened.
  defp unit_price_for(%ProductVariant{} = variant, input) do
    case Map.get(input, "unit_price") do
      nil -> variant.price
      value -> to_quantity(value)
    end
  end

  defp line_total(unit_price, quantity, modifiers) do
    modifiers
    |> Enum.map(& &1.price_delta)
    |> Money.sum()
    |> Money.add(unit_price)
    |> Money.mult(quantity)
    |> Money.round_working()
  end

  defp next_position(order_id) do
    OrderItem
    |> where([item], item.order_id == ^order_id)
    |> select([item], max(item.position))
    |> Repo.one()
    |> case do
      nil -> 0
      position -> position + 1
    end
  end

  defp refresh_order_totals(%Scope{} = scope, order_id) do
    case reload_order(scope, order_id) do
      nil ->
        :ok

      %Order{} = order ->
        subtotal = order.items |> Enum.map(& &1.line_total) |> Money.sum()

        totals = %{
          subtotal: subtotal,
          discount_total: Money.zero(),
          tax_total: Money.zero(),
          total: subtotal
        }

        {:ok, _updated} = order |> Order.totals_changeset(totals) |> Repo.update()
        :ok
    end
  end

  defp reload_order(%Scope{} = scope, order_id) do
    Order
    |> Scoped.for_business(scope)
    |> where([order], order.id == ^order_id)
    |> preload([:customer, items: :modifiers])
    |> Repo.one()
  end

  defp variant_label(%ProductVariant{} = variant) do
    case variant.product do
      %Product{} = product ->
        if variant.is_default or is_nil(variant.name),
          do: product.name,
          else: "#{product.name} — #{variant.name}"

      _not_loaded ->
        variant.name || variant.sku || "Item"
    end
  end

  defp stockable?(%{variant: %ProductVariant{product: %Product{tracks_stock: tracks}}}),
    do: tracks

  defp stockable?(_item), do: false

  defp restrict_to_own(query, %Scope{} = scope) do
    if Scope.can?(scope, "sale:view_all") do
      query
    else
      user_id = Scope.user_id(scope)
      where(query, [sale], sale.cashier_id == ^user_id)
    end
  end

  defp apply_sale_filters(query, filters) do
    Enum.reduce(filters, query, fn
      {"status", status}, acc when is_binary(status) ->
        where(acc, [sale], sale.status == ^status)

      {"branch_id", branch_id}, acc when is_binary(branch_id) ->
        where(acc, [sale], sale.branch_id == ^branch_id)

      {"customer_id", customer_id}, acc when is_binary(customer_id) ->
        where(acc, [sale], sale.customer_id == ^customer_id)

      {"shift_id", shift_id}, acc when is_binary(shift_id) ->
        where(acc, [sale], sale.shift_id == ^shift_id)

      {"from", %Date{} = from}, acc ->
        where(acc, [sale], fragment("?::date", sale.sold_at) >= ^from)

      {"to", %Date{} = to}, acc ->
        where(acc, [sale], fragment("?::date", sale.sold_at) <= ^to)

      _other, acc ->
        acc
    end)
  end

  defp filter_status(query, %{"status" => status}) when is_binary(status),
    do: where(query, [record], record.status == ^status)

  defp filter_status(query, _filters), do: query

  defp filter_sale(query, %{"sale_id" => sale_id}) when is_binary(sale_id),
    do: where(query, [record], record.sale_id == ^sale_id)

  defp filter_sale(query, _filters), do: query

  defp insert_refund_request(%Scope{} = scope, %Sale{} = sale, attrs, number) do
    attrs = stringify(attrs)

    request_attrs = %{
      organization_id: sale.organization_id,
      business_id: sale.business_id,
      branch_id: sale.branch_id,
      sale_id: sale.id,
      number: number,
      reason: Map.get(attrs, "reason"),
      requested_amount: to_optional_amount(Map.get(attrs, "requested_amount")),
      requested_by_id: Scope.user_id(scope)
    }

    %RefundRequest{} |> RefundRequest.create_changeset(request_attrs) |> Repo.insert()
  end

  defp insert_refund_request_items(%RefundRequest{} = request, items) do
    Enum.reduce_while(items, :ok, fn input, :ok ->
      attrs = %{
        refund_request_id: request.id,
        sale_item_id: Map.get(input, "sale_item_id"),
        quantity: to_quantity(Map.get(input, "quantity")),
        restock: Map.get(input, "restock", true) != false,
        reason: Map.get(input, "reason")
      }

      case %RefundRequestItem{} |> RefundRequestItem.changeset(attrs) |> Repo.insert() do
        {:ok, _item} -> {:cont, :ok}
        {:error, failure} -> {:halt, {:error, failure}}
      end
    end)
  end

  defp to_quantity(value) do
    case Money.cast(value) do
      {:ok, amount} -> amount
      :error -> Money.zero()
    end
  end

  defp to_optional_amount(nil), do: nil

  defp to_optional_amount(value) do
    case Money.cast(value) do
      {:ok, amount} -> amount
      :error -> nil
    end
  end

  defp stringify(map) when is_map(map) and not is_struct(map) do
    Map.new(map, fn
      {key, value} when is_atom(key) -> {Atom.to_string(key), value}
      {key, value} -> {key, value}
    end)
  end

  defp stringify(other), do: other
end
