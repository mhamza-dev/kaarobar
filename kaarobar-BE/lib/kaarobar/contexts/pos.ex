defmodule Kaarobar.Pos do
  import Ecto.Query
  alias Kaarobar.Repo
  alias Kaarobar.Schemas.{Sale, SaleItem, SalePayment, SaleReturn, SaleReturnItem, Till, InventoryRecord}
  alias Ecto.Multi

  def create_sale(branch_id, owner_id, business_id, cashier_id, attrs) do
    client_txn_id = attrs[:client_txn_id] || Ecto.UUID.generate()

    case Repo.get_by(Sale, client_txn_id: client_txn_id) do
      %Sale{} = existing_sale ->
        {:ok, existing_sale}

      nil ->
        Multi.new()
        |> Multi.run(:check_stock, fn _repo, _ ->
          items = attrs[:items] || []

          stock_checks = Enum.map(items, fn item ->
            inventory = Repo.get_by(InventoryRecord,
              branch_id: branch_id,
              product_id: item.product_id
            )

            if inventory && Decimal.compare(inventory.quantity_on_hand, item.quantity) in [:gt, :eq] do
              {:ok, item}
            else
              {:error, {:insufficient_stock, item.product_id}}
            end
          end)

          if Enum.all?(stock_checks, fn {status, _} -> status == :ok end) do
            {:ok, items}
          else
            error = Enum.find(stock_checks, fn {status, _} -> status == :error end)
            error
          end
        end)
        |> Multi.run(:decrement_stock, fn _repo, %{check_stock: items} ->
          Enum.each(items, fn item ->
            from(i in InventoryRecord,
              where: i.branch_id == ^branch_id and i.product_id == ^item.product_id and
                     i.quantity_on_hand >= ^item.quantity,
              update: [set: [quantity_on_hand: fragment("quantity_on_hand - ?", ^item.quantity)]]
            )
            |> Repo.update_all([])
          end)

          {:ok, :decremented}
        end)
        |> Multi.insert(:sale, fn _ ->
          %Sale{}
          |> Sale.changeset(Map.merge(attrs, %{
            branch_id: branch_id,
            owner_id: owner_id,
            business_id: business_id,
            cashier_id: cashier_id,
            client_txn_id: client_txn_id,
            invoice_number: attrs[:invoice_number] || generate_invoice_number()
          }))
        end)
        |> Multi.run(:items, fn _repo, %{sale: sale, check_stock: items} ->
          results = Enum.map(items, fn item_attrs ->
            %SaleItem{}
            |> SaleItem.changeset(Map.put(item_attrs, :sale_id, sale.id))
            |> Repo.insert()
          end)

          if Enum.all?(results, fn {status, _} -> status == :ok end) do
            {:ok, Enum.map(results, fn {:ok, item} -> item end)}
          else
            {:error, :item_insert_failed}
          end
        end)
        |> Multi.run(:payments, fn _repo, %{sale: sale} ->
          payments = attrs[:payments] || []
          results = Enum.map(payments, fn payment_attrs ->
            %SalePayment{}
            |> SalePayment.changeset(Map.put(payment_attrs, :sale_id, sale.id))
            |> Repo.insert()
          end)

          if Enum.all?(results, fn {status, _} -> status == :ok end) do
            {:ok, Enum.map(results, fn {:ok, p} -> p end)}
          else
            {:error, :payment_insert_failed}
          end
        end)
        |> Multi.run(:enqueue_journal, fn _repo, %{sale: sale} ->
          %{sale_id: sale.id, business_id: business_id, owner_id: owner_id, posted_by_id: cashier_id}
          |> Kaarobar.Workers.PostSaleJournalWorker.new()
          |> Oban.insert()

          {:ok, :enqueued}
        end)
        |> Multi.run(:enqueue_fbr, fn _repo, %{sale: sale} ->
          business = Repo.get(Kaarobar.Schemas.Business, business_id)

          if business && business.fbr_tier1 do
            %{sale_id: sale.id}
            |> Kaarobar.Workers.FbrReportWorker.new()
            |> Oban.insert()
          end

          {:ok, :enqueued}
        end)
        |> Repo.transaction()
        |> case do
          {:ok, %{sale: sale}} -> {:ok, sale}
          {:error, _op, reason, _changes} -> {:error, reason}
        end
    end
  end

  defp generate_invoice_number do
    "INV-#{:os.system_time(:millisecond)}"
  end

  def create_return(sale_id, owner_id, business_id, branch_id, requested_by_id, attrs) do
    Multi.new()
    |> Multi.insert(:sale_return, fn _ ->
      %SaleReturn{}
      |> SaleReturn.changeset(Map.merge(attrs, %{
        sale_id: sale_id,
        owner_id: owner_id,
        business_id: business_id,
        branch_id: branch_id,
        requested_by_id: requested_by_id
      }))
    end)
    |> Multi.run(:items, fn _repo, %{sale_return: sale_return} ->
      items = attrs[:items] || []
      results = Enum.map(items, fn item_attrs ->
        %SaleReturnItem{}
        |> SaleReturnItem.changeset(Map.put(item_attrs, :sale_return_id, sale_return.id))
        |> Repo.insert()
      end)

      if Enum.all?(results, fn {status, _} -> status == :ok end) do
        {:ok, Enum.map(results, fn {:ok, item} -> item end)}
      else
        {:error, :item_insert_failed}
      end
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{sale_return: sale_return}} -> {:ok, sale_return}
      {:error, _op, reason, _changes} -> {:error, reason}
    end
  end

  def approve_return(return_id, approved_by_id) do
    sale_return = Repo.get(SaleReturn, return_id) |> Repo.preload([:items, :branch])

    if sale_return do
      Multi.new()
      |> Multi.update(:approve, fn _ ->
        sale_return
        |> SaleReturn.changeset(%{status: "Approved", approved_by_id: approved_by_id})
      end)
      |> Multi.run(:restore_stock, fn _repo, _ ->
        Enum.each(sale_return.items, fn item ->
          case Repo.get_by(InventoryRecord,
            branch_id: sale_return.branch_id,
            product_id: item.product_id
          ) do
            nil -> :ok
            inventory ->
              inventory
              |> InventoryRecord.changeset(%{
                quantity_on_hand: Decimal.add(inventory.quantity_on_hand, item.quantity)
              })
              |> Repo.update()
          end
        end)

        {:ok, :restored}
      end)
      |> Repo.transaction()
      |> case do
        {:ok, %{approve: sale_return}} -> {:ok, sale_return}
        {:error, _op, reason, _changes} -> {:error, reason}
      end
    else
      {:error, :not_found}
    end
  end

  def open_till(branch_id, owner_id, business_id, cashier_id, opening_cash) do
    %Till{}
    |> Till.changeset(%{
      branch_id: branch_id,
      owner_id: owner_id,
      business_id: business_id,
      cashier_id: cashier_id,
      opened_at: DateTime.utc_now(),
      opening_cash: opening_cash,
      status: "open"
    })
    |> Repo.insert()
  end

  def close_till(till_id, closing_cash) do
    till = Repo.get(Till, till_id)

    if till && till.status == "open" do
      sales_total = from(s in Sale,
        where: s.till_id == ^till_id,
        select: sum(s.total_amount)
      ) |> Repo.one() || Decimal.new(0)

      expected_cash = Decimal.add(till.opening_cash, sales_total)

      till
      |> Till.changeset(%{
        closed_at: DateTime.utc_now(),
        closing_cash: closing_cash,
        expected_cash: expected_cash,
        status: "closed"
      })
      |> Repo.update()
    else
      {:error, :invalid_till}
    end
  end

  def list_sales(branch_id, owner_id, business_id) do
    Sale
    |> where([s], s.branch_id == ^branch_id and s.owner_id == ^owner_id and s.business_id == ^business_id)
    |> order_by([s], desc: s.inserted_at)
    |> Repo.all()
  end

  def get_sale(sale_id, owner_id) do
    Sale
    |> where([s], s.id == ^sale_id and s.owner_id == ^owner_id)
    |> preload([:items, :payments, :returns])
    |> Repo.one()
  end
end
