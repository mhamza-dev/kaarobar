defmodule Kaarobar.Pos do
  @moduledoc """
  Online POS vertical (POS-FR Must): sales, tills, returns, invoice sequences.
  """

  import Ecto.Query

  alias Kaarobar.Repo
  alias Kaarobar.Schemas.{
    Branch,
    InventoryRecord,
    InvoiceSequence,
    Product,
    ProductBranchPrice,
    Sale,
    SaleItem,
    SalePayment,
    SaleReturn,
    SaleReturnItem,
    Till
  }
  alias Ecto.Multi

  @payment_methods ~w(cash card wallet)
  @default_return_window_days 14

  ## —— Sales (POS-FR-001–006, 009, 011) ————————————————————————————

  def create_sale(branch_id, owner_id, business_id, cashier_id, attrs) do
    client_txn_id = attrs[:client_txn_id] || attrs["client_txn_id"]

    with :ok <- require_uuid(client_txn_id) do
      case Repo.get_by(Sale, client_txn_id: client_txn_id) do
        %Sale{} = existing ->
          {:ok, Repo.preload(existing, [:items, :payments])}

        nil ->
          with {:ok, branch} <- fetch_branch(branch_id, business_id, owner_id),
               {:ok, priced_items} <- resolve_line_items(branch_id, business_id, owner_id, attrs),
               {:ok, money} <- compute_totals(priced_items, attrs),
               :ok <- validate_discount_limit(branch, money.discount_amount, attrs),
               {:ok, payments} <-
                 normalize_payments(attrs[:payments] || attrs["payments"] || [], money.total_amount) do
            do_create_sale(
              branch,
              owner_id,
              business_id,
              cashier_id,
              client_txn_id,
              priced_items,
              money,
              payments,
              attrs
            )
          end
      end
    end
  end

  defp do_create_sale(
         branch,
         owner_id,
         business_id,
         cashier_id,
         client_txn_id,
         priced_items,
         money,
         payments,
         attrs
       ) do
    Multi.new()
    |> Multi.run(:invoice_number, fn _repo, _ ->
      next_invoice_number(branch.id, business_id, owner_id)
    end)
    |> Multi.run(:decrement_stock, fn _repo, _ ->
      decrement_stock!(branch.id, priced_items)
    end)
    |> Multi.insert(:sale, fn %{invoice_number: invoice_number} ->
      %Sale{}
      |> Sale.changeset(%{
        branch_id: branch.id,
        owner_id: owner_id,
        business_id: business_id,
        cashier_id: cashier_id,
        client_txn_id: client_txn_id,
        invoice_number: invoice_number,
        customer_id: attrs[:customer_id] || attrs["customer_id"],
        till_id: attrs[:till_id] || attrs["till_id"],
        status: "Completed",
        subtotal: money.subtotal,
        tax_amount: money.tax_amount,
        discount_amount: money.discount_amount,
        total_amount: money.total_amount,
        notes: attrs[:notes] || attrs["notes"]
      })
    end)
    |> Multi.run(:items, fn _repo, %{sale: sale} ->
      insert_sale_items(sale.id, priced_items)
    end)
    |> Multi.run(:payments, fn _repo, %{sale: sale} ->
      insert_payments(sale.id, payments)
    end)
    |> Multi.run(:enqueue_journal, fn _repo, %{sale: sale} ->
      %{sale_id: sale.id, business_id: business_id, owner_id: owner_id, posted_by_id: cashier_id}
      |> Kaarobar.Workers.PostSaleJournalWorker.new()
      |> Oban.insert()
    end)
    |> Multi.run(:enqueue_fbr, fn _repo, %{sale: sale} ->
      business = Repo.get(Kaarobar.Schemas.Business, business_id)

      if business && business.fbr_tier1 do
        %{sale_id: sale.id}
        |> Kaarobar.Workers.FbrReportWorker.new()
        |> Oban.insert()
      else
        {:ok, :skipped}
      end
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{sale: sale}} ->
        {:ok, Repo.preload(sale, [:items, :payments])}

      {:error, :sale, %{errors: errors}, _} ->
        if Keyword.has_key?(errors, :client_txn_id) do
          case Repo.get_by(Sale, client_txn_id: client_txn_id) do
            nil -> {:error, :duplicate_client_txn}
            sale -> {:ok, Repo.preload(sale, [:items, :payments])}
          end
        else
          {:error, errors}
        end

      {:error, _op, reason, _changes} ->
        {:error, reason}
    end
  end

  defp resolve_line_items(branch_id, business_id, owner_id, attrs) do
    raw_items = attrs[:items] || attrs["items"] || []

    if raw_items == [] do
      {:error, :empty_cart}
    else
      Enum.reduce_while(raw_items, {:ok, []}, fn raw, {:ok, acc} ->
        case build_line(raw, branch_id, business_id, owner_id) do
          {:ok, line} -> {:cont, {:ok, [line | acc]}}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end)
      |> case do
        {:ok, lines} -> {:ok, Enum.reverse(lines)}
        err -> err
      end
    end
  end

  defp build_line(raw, branch_id, business_id, owner_id) do
    product_id = raw[:product_id] || raw["product_id"]
    qty = to_dec(raw[:quantity] || raw["quantity"])
    line_discount = to_dec(raw[:discount] || raw["discount"] || 0)

    with %Product{} = product <-
           Repo.get_by(Product, id: product_id, business_id: business_id, owner_id: owner_id),
         true <- product.is_active || {:error, :product_inactive},
         unit_price <- branch_price(product, branch_id, raw),
         true <- Decimal.compare(qty, 0) == :gt || {:error, :invalid_quantity} do
      taxable = max_dec(Decimal.sub(Decimal.mult(qty, unit_price), line_discount), 0)
      tax_rate = product.tax_rate || Decimal.new("0.18")
      tax = Decimal.mult(taxable, tax_rate) |> Decimal.round(2)
      line_total = Decimal.add(taxable, tax) |> Decimal.round(2)

      {:ok,
       %{
         product_id: product.id,
         sku: product.sku,
         name: product.name,
         quantity: qty,
         unit_price: unit_price,
         discount: line_discount,
         tax_rate: tax_rate,
         line_total: line_total,
         taxable: taxable,
         tax: tax
       }}
    else
      nil -> {:error, {:product_not_found, product_id}}
      {:error, _} = err -> err
      false -> {:error, :product_inactive}
    end
  end

  defp branch_price(product, branch_id, raw) do
    case Repo.get_by(ProductBranchPrice, product_id: product.id, branch_id: branch_id) do
      %{price: price} ->
        price

      nil ->
        # Fall back to client price only if no branch price configured
        to_dec(raw[:unit_price] || raw["unit_price"] || 0)
    end
  end

  defp compute_totals(items, attrs) do
    cart_discount = to_dec(attrs[:discount_amount] || attrs["discount_amount"] || 0)
    line_discount = Enum.reduce(items, Decimal.new(0), &Decimal.add(&2, &1.discount))
    subtotal_gross = Enum.reduce(items, Decimal.new(0), fn i, acc ->
      Decimal.add(acc, Decimal.mult(i.quantity, i.unit_price))
    end)
    tax_amount = Enum.reduce(items, Decimal.new(0), &Decimal.add(&2, &1.tax))
    discount_amount = Decimal.add(line_discount, cart_discount)
    taxable_after_cart =
      max_dec(Decimal.sub(Decimal.sub(subtotal_gross, line_discount), cart_discount), 0)

    # Cart-level discount reduces tax proportionally if applied after lines
    tax_after =
      if Decimal.compare(cart_discount, 0) == :gt and Decimal.compare(subtotal_gross, 0) == :gt do
        factor =
          Decimal.div(taxable_after_cart, max_dec(Decimal.sub(subtotal_gross, line_discount), Decimal.new("0.01")))

        Decimal.mult(tax_amount, factor) |> Decimal.round(2)
      else
        tax_amount |> Decimal.round(2)
      end

    total =
      Decimal.add(taxable_after_cart, tax_after)
      |> Decimal.round(2)

    {:ok,
     %{
       subtotal: Decimal.sub(subtotal_gross, line_discount) |> Decimal.round(2),
       tax_amount: tax_after,
       discount_amount: discount_amount |> Decimal.round(2),
       total_amount: total
     }}
  end

  defp validate_discount_limit(branch, discount_amount, attrs) do
    limit = branch.discount_auto_approve_limit || Decimal.new("0")
    force_pending? = attrs[:requires_discount_approval] == true

    cond do
      Decimal.compare(discount_amount, 0) != :gt ->
        :ok

      force_pending? ->
        {:error, :discount_requires_approval}

      Decimal.compare(discount_amount, limit) == :gt ->
        {:error, {:discount_exceeds_limit, to_string(limit)}}

      true ->
        :ok
    end
  end

  defp normalize_payments(raw_payments, total) do
    payments =
      Enum.map(raw_payments, fn p ->
        method = p[:method] || p["method"] || "cash"
        %{
          method: method,
          amount: to_dec(p[:amount] || p["amount"]),
          reference: p[:reference] || p["reference"]
        }
      end)

    cond do
      payments == [] ->
        {:error, :payments_required}

      Enum.any?(payments, &(&1.method not in @payment_methods)) ->
        {:error, :invalid_payment_method}

      true ->
        sum = Enum.reduce(payments, Decimal.new(0), &Decimal.add(&2, &1.amount))

        if Decimal.compare(sum, total) == :eq do
          {:ok, payments}
        else
          {:error, {:payment_mismatch, to_string(total), to_string(sum)}}
        end
    end
  end

  defp decrement_stock!(branch_id, items) do
    Enum.reduce_while(items, {:ok, :decremented}, fn item, acc ->
      {count, _} =
        from(i in InventoryRecord,
          where:
            i.branch_id == ^branch_id and i.product_id == ^item.product_id and
              i.quantity_on_hand >= ^item.quantity,
          update: [set: [quantity_on_hand: fragment("quantity_on_hand - ?", ^item.quantity)]]
        )
        |> Repo.update_all([])

      if count == 1 do
        {:cont, acc}
      else
        {:halt, {:error, {:insufficient_stock, item.product_id}}}
      end
    end)
  end

  defp insert_sale_items(sale_id, items) do
    results =
      Enum.map(items, fn item ->
        %SaleItem{}
        |> SaleItem.changeset(%{
          sale_id: sale_id,
          product_id: item.product_id,
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount,
          tax_rate: item.tax_rate,
          line_total: item.line_total
        })
        |> Repo.insert()
      end)

    if Enum.all?(results, &match?({:ok, _}, &1)) do
      {:ok, Enum.map(results, fn {:ok, i} -> i end)}
    else
      {:error, :item_insert_failed}
    end
  end

  defp insert_payments(sale_id, payments) do
    results =
      Enum.map(payments, fn p ->
        %SalePayment{}
        |> SalePayment.changeset(Map.put(p, :sale_id, sale_id))
        |> Repo.insert()
      end)

    if Enum.all?(results, &match?({:ok, _}, &1)) do
      {:ok, Enum.map(results, fn {:ok, p} -> p end)}
    else
      {:error, :payment_insert_failed}
    end
  end

  defp next_invoice_number(branch_id, business_id, owner_id) do
    case Repo.get_by(InvoiceSequence, branch_id: branch_id) do
      nil ->
        case %InvoiceSequence{}
             |> InvoiceSequence.changeset(%{
               branch_id: branch_id,
               business_id: business_id,
               owner_id: owner_id,
               next_number: 2
             })
             |> Repo.insert() do
          {:ok, _} ->
            {:ok, format_invoice(1)}

          {:error, _} ->
            seq = Repo.get_by!(InvoiceSequence, branch_id: branch_id)
            bump_and_format(seq)
        end

      seq ->
        bump_and_format(seq)
    end
  end

  defp bump_and_format(seq) do
    case bump_sequence(seq) do
      {:ok, n} -> {:ok, format_invoice(n)}
      err -> err
    end
  end

  defp bump_sequence(seq) do
    # PostgreSQL RETURNING yields the *new* next_number; subtract 1 for the issued invoice.
    {1, [n]} =
      from(s in InvoiceSequence,
        where: s.id == ^seq.id,
        select: fragment("next_number - 1"),
        update: [inc: [next_number: 1]]
      )
      |> Repo.update_all([])

    {:ok, n}
  end

  defp format_invoice(n) when is_integer(n) do
    "INV-#{String.pad_leading(Integer.to_string(n), 6, "0")}"
  end

  ## —— Returns (POS-FR-007 / 008) ————————————————————————————————

  def create_return(sale_id, owner_id, business_id, branch_id, requested_by_id, attrs) do
    with %Sale{} = sale <- get_sale(sale_id, owner_id),
         true <- sale.business_id == business_id || {:error, :wrong_business},
         true <- sale.branch_id == branch_id || {:error, :wrong_branch},
         {:ok, branch} <- fetch_branch(branch_id, business_id, owner_id),
         :ok <- validate_return_window(sale, branch),
         {:ok, items} <- normalize_return_items(sale, attrs),
         refund_amount <- Enum.reduce(items, Decimal.new(0), &Decimal.add(&2, &1.amount)),
         status <- return_status(branch, refund_amount) do
      Multi.new()
      |> Multi.insert(:sale_return, fn _ ->
        %SaleReturn{}
        |> SaleReturn.changeset(%{
          sale_id: sale.id,
          owner_id: owner_id,
          business_id: business_id,
          branch_id: branch_id,
          requested_by_id: requested_by_id,
          refund_amount: refund_amount,
          reason: attrs[:reason] || attrs["reason"],
          status: if(status == "Approved", do: "PendingApproval", else: status),
          # Insert as Pending first; auto-approve step updates + restores stock
        })
      end)
      |> Multi.run(:items, fn _repo, %{sale_return: sale_return} ->
        insert_return_items(sale_return.id, items)
      end)
      |> Multi.run(:finalize, fn _repo, %{sale_return: sale_return} ->
        if status == "Approved" do
          finalize_return_approval(
            Repo.preload(sale_return, [:items, :sale]),
            requested_by_id
          )
        else
          {:ok, Repo.preload(sale_return, [:items])}
        end
      end)
      |> Repo.transaction()
      |> case do
        {:ok, %{finalize: result}} -> {:ok, result}
        {:error, _op, reason, _} -> {:error, reason}
      end
    else
      nil -> {:error, :sale_not_found}
      {:error, _} = err -> err
      false -> {:error, :forbidden}
    end
  end

  defp return_status(branch, refund_amount) do
    limit = branch.refund_auto_approve_limit || Decimal.new("0")

    if Decimal.compare(refund_amount, limit) in [:lt, :eq] do
      "Approved"
    else
      "PendingApproval"
    end
  end

  defp validate_return_window(sale, branch) do
    days = branch.return_window_days || @default_return_window_days
    cutoff = DateTime.add(sale.inserted_at, days * 86_400, :second)

    if DateTime.compare(DateTime.utc_now(), cutoff) == :gt do
      {:error, :return_window_expired}
    else
      :ok
    end
  end

  defp normalize_return_items(sale, attrs) do
    sale = Repo.preload(sale, :items)
    raw = attrs[:items] || attrs["items"] || []

    already_returned =
      from(ri in SaleReturnItem,
        join: r in SaleReturn,
        on: r.id == ri.sale_return_id,
        where: r.sale_id == ^sale.id and r.status in ["Approved", "PendingApproval"],
        group_by: ri.product_id,
        select: {ri.product_id, sum(ri.quantity)}
      )
      |> Repo.all()
      |> Map.new()

    if raw == [] do
      {:error, :empty_return}
    else
      Enum.reduce_while(raw, {:ok, []}, fn raw_item, {:ok, acc} ->
        product_id = raw_item[:product_id] || raw_item["product_id"]
        qty = to_dec(raw_item[:quantity] || raw_item["quantity"])
        sale_item = Enum.find(sale.items, &(&1.product_id == product_id))

        cond do
          is_nil(sale_item) ->
            {:halt, {:error, {:item_not_on_sale, product_id}}}

          Decimal.compare(qty, 0) != :gt ->
            {:halt, {:error, :invalid_quantity}}

          true ->
            prior = Map.get(already_returned, product_id, Decimal.new(0))
            remaining = Decimal.sub(sale_item.quantity, prior)

            if Decimal.compare(qty, remaining) == :gt do
              {:halt, {:error, {:return_qty_exceeds_sale, product_id}}}
            else
              unit = Decimal.div(sale_item.line_total, sale_item.quantity)
              amount = Decimal.mult(unit, qty) |> Decimal.round(2)

              {:cont,
               {:ok,
                [
                  %{
                    product_id: product_id,
                    sale_item_id: sale_item.id,
                    quantity: qty,
                    amount: amount
                  }
                  | acc
                ]}}
            end
        end
      end)
      |> case do
        {:ok, items} -> {:ok, Enum.reverse(items)}
        err -> err
      end
    end
  end

  defp insert_return_items(sale_return_id, items) do
    results =
      Enum.map(items, fn item ->
        %SaleReturnItem{}
        |> SaleReturnItem.changeset(Map.put(item, :sale_return_id, sale_return_id))
        |> Repo.insert()
      end)

    if Enum.all?(results, &match?({:ok, _}, &1)) do
      {:ok, Enum.map(results, fn {:ok, i} -> i end)}
    else
      {:error, :item_insert_failed}
    end
  end

  def approve_return(return_id, approved_by_id, owner_id \\ nil) do
    query = from(r in SaleReturn, where: r.id == ^return_id)

    query =
      if owner_id do
        where(query, [r], r.owner_id == ^owner_id)
      else
        query
      end

    sale_return =
      case Repo.one(query) do
        nil -> nil
        ret -> Repo.preload(ret, [:items, :sale])
      end

    cond do
      is_nil(sale_return) ->
        {:error, :not_found}

      sale_return.status == "Approved" and not is_nil(sale_return.approved_by_id) ->
        {:ok, sale_return}

      sale_return.status not in ["PendingApproval", "Approved"] ->
        {:error, :invalid_status}

      true ->
        finalize_return_approval(sale_return, approved_by_id)
    end
  end

  defp finalize_return_approval(sale_return, approved_by_id) do
    # When already Approved without approved_by (shouldn't happen), treat as idempotent below.
    if sale_return.status == "Approved" and not is_nil(sale_return.approved_by_id) do
      {:ok, Repo.preload(sale_return, [:items])}
    else
      do_finalize_return(sale_return, approved_by_id)
    end
  end

  defp do_finalize_return(sale_return, approved_by_id) do
    sale_return = Repo.preload(sale_return, [:items, :sale])

    Multi.new()
    |> Multi.update(
      :approve,
      SaleReturn.changeset(sale_return, %{status: "Approved", approved_by_id: approved_by_id})
    )
    |> Multi.run(:restore_stock, fn _repo, _ ->
      Enum.reduce_while(sale_return.items, {:ok, :restored}, fn item, acc ->
        case Repo.get_by(InventoryRecord,
               branch_id: sale_return.branch_id,
               product_id: item.product_id
             ) do
          nil ->
            {:halt, {:error, {:inventory_missing, item.product_id}}}

          inventory ->
            inventory
            |> InventoryRecord.changeset(%{
              quantity_on_hand: Decimal.add(inventory.quantity_on_hand, item.quantity)
            })
            |> Repo.update()
            |> case do
              {:ok, _} -> {:cont, acc}
              {:error, cs} -> {:halt, {:error, cs}}
            end
        end
      end)
    end)
    |> Multi.run(:update_sale_status, fn _repo, _ ->
      update_sale_refund_status(sale_return.sale_id)
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{approve: ret}} -> {:ok, Repo.preload(ret, [:items])}
      {:error, _op, reason, _} -> {:error, reason}
    end
  end

  defp update_sale_refund_status(sale_id) do
    sale = Repo.get(Sale, sale_id) |> Repo.preload([:items, :returns])

    approved_returns =
      Enum.filter(sale.returns || [], &(&1.status == "Approved"))
      |> Repo.preload(:items)
      |> then(fn _ ->
        from(r in SaleReturn, where: r.sale_id == ^sale_id and r.status == "Approved", preload: [:items])
        |> Repo.all()
      end)

    returned_by_product =
      approved_returns
      |> Enum.flat_map(& &1.items)
      |> Enum.reduce(%{}, fn item, acc ->
        Map.update(acc, item.product_id, item.quantity, &Decimal.add(&1, item.quantity))
      end)

    fully? =
      Enum.all?(sale.items, fn si ->
        returned = Map.get(returned_by_product, si.product_id, Decimal.new(0))
        Decimal.compare(returned, si.quantity) in [:gt, :eq]
      end)

    partially? = map_size(returned_by_product) > 0

    status =
      cond do
        fully? -> "FullyRefunded"
        partially? -> "PartiallyRefunded"
        true -> sale.status
      end

    sale
    |> Sale.changeset(%{status: status})
    |> Repo.update()
  end

  ## —— Tills (POS-FR-010) ————————————————————————————————————————

  def open_till(branch_id, owner_id, business_id, cashier_id, opening_cash) do
    with {:ok, _} <- fetch_branch(branch_id, business_id, owner_id),
         nil <- open_till_for_branch(branch_id) do
      %Till{}
      |> Till.changeset(%{
        branch_id: branch_id,
        owner_id: owner_id,
        business_id: business_id,
        cashier_id: cashier_id,
        opened_at: DateTime.utc_now() |> DateTime.truncate(:second),
        opening_cash: to_dec(opening_cash),
        status: "open"
      })
      |> Repo.insert()
    else
      %Till{} -> {:error, :till_already_open}
      {:error, _} = err -> err
    end
  end

  def close_till(till_id, owner_id, closing_cash) do
    till = Repo.get_by(Till, id: till_id, owner_id: owner_id)

    if till && till.status == "open" do
      cash_sales =
        from(p in SalePayment,
          join: s in Sale,
          on: s.id == p.sale_id,
          where: s.till_id == ^till_id and p.method == "cash",
          select: coalesce(sum(p.amount), 0)
        )
        |> Repo.one()

      cash_refunds =
        from(r in SaleReturn,
          where: r.branch_id == ^till.branch_id and r.status == "Approved" and
                   r.inserted_at >= ^till.opened_at,
          select: coalesce(sum(r.refund_amount), 0)
        )
        |> Repo.one()

      expected =
        till.opening_cash
        |> Decimal.add(cash_sales || Decimal.new(0))
        |> Decimal.sub(cash_refunds || Decimal.new(0))
        |> Decimal.round(2)

      closing = to_dec(closing_cash)
      over_short = Decimal.sub(closing, expected) |> Decimal.round(2)

      till
      |> Till.changeset(%{
        closed_at: DateTime.utc_now() |> DateTime.truncate(:second),
        closing_cash: closing,
        expected_cash: expected,
        over_short: over_short,
        status: "closed"
      })
      |> Repo.update()
    else
      {:error, :invalid_till}
    end
  end

  def open_till_for_branch(branch_id) do
    Repo.get_by(Till, branch_id: branch_id, status: "open")
  end

  ## —— Queries ——————————————————————————————————————————————————

  def list_sales(branch_id, owner_id, business_id) do
    Sale
    |> where(
      [s],
      s.branch_id == ^branch_id and s.owner_id == ^owner_id and s.business_id == ^business_id
    )
    |> order_by([s], desc: s.inserted_at)
    |> preload([:items, :payments])
    |> Repo.all()
  end

  def get_sale(sale_id, owner_id) do
    Sale
    |> where([s], s.id == ^sale_id and s.owner_id == ^owner_id)
    |> preload([:items, :payments, :returns])
    |> Repo.one()
  end

  ## —— Helpers ——————————————————————————————————————————————————

  defp fetch_branch(branch_id, business_id, owner_id) do
    case Repo.get_by(Branch, id: branch_id, business_id: business_id, owner_id: owner_id) do
      nil -> {:error, :branch_not_found}
      %{is_active: false} -> {:error, :branch_inactive}
      branch -> {:ok, branch}
    end
  end

  defp require_uuid(nil), do: {:error, :client_txn_id_required}
  defp require_uuid(""), do: {:error, :client_txn_id_required}

  defp require_uuid(id) when is_binary(id) do
    case Ecto.UUID.cast(id) do
      {:ok, _} -> :ok
      :error -> {:error, :invalid_client_txn_id}
    end
  end

  defp to_dec(%Decimal{} = d), do: d
  defp to_dec(nil), do: Decimal.new(0)
  defp to_dec(v), do: Decimal.new("#{v}")

  defp max_dec(a, b) do
    if Decimal.compare(a, b) == :lt, do: b, else: a
  end
end
