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
    ProductVariant,
    Modifier,
    Sale,
    SaleItem,
    SalePayment,
    SaleReturn,
    SaleReturnItem,
    Till
  }
  alias Kaarobar.Catalog
  alias Ecto.Multi

  @payment_methods ~w(cash card wallet khata)
  @default_return_window_days 14

  ## —— Sales (POS-FR-001–006, 009, 011) ————————————————————————————

  def create_sale(branch_id, owner_id, business_id, cashier_id, attrs) do
    client_txn_id = attrs[:client_txn_id] || attrs["client_txn_id"]

    with :ok <- require_uuid(client_txn_id) do
      case Repo.get_by(Sale, client_txn_id: client_txn_id) do
        %Sale{} = existing ->
          {:ok, Repo.preload(existing, [:items, :payments, :customer])}

        nil ->
          with {:ok, branch} <- fetch_branch(branch_id, business_id, owner_id),
               {:ok, priced_items} <- resolve_line_items(branch_id, business_id, owner_id, attrs),
               {:ok, money} <- compute_totals(priced_items, attrs),
               {:ok, money, redeem_points} <-
                 apply_loyalty_redeem(business_id, owner_id, attrs, money),
               {:ok, money, coupon, coupon_discount} <-
                 apply_coupon(business_id, owner_id, attrs, money),
               :ok <- validate_discount_limit(branch, money.discount_amount, attrs),
               {:ok, payments} <-
                 normalize_payments(
                   attrs[:payments] || attrs["payments"] || [],
                   money.total_amount
                 ),
               {:ok, customer_id} <- validate_customer_for_sale(business_id, owner_id, attrs, payments),
               :ok <- validate_online_sale(attrs, cashier_id, payments) do
            do_create_sale(
              branch,
              owner_id,
              business_id,
              cashier_id,
              client_txn_id,
              priced_items,
              money,
              payments,
              Map.merge(attrs, %{
                customer_id: customer_id,
                loyalty_redeem_points: redeem_points,
                applied_coupon: coupon,
                coupon_discount: coupon_discount
              })
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
      source = sale_source(attrs)

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
        source: source,
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
    |> Multi.run(:khata_ar, fn _repo, %{sale: sale} ->
      maybe_create_khata_ar(sale, payments, cashier_id || owner_id)
    end)
    |> Multi.run(:enqueue_journal, fn _repo, %{sale: sale} ->
      %{
        sale_id: sale.id,
        business_id: business_id,
        owner_id: owner_id,
        posted_by_id: cashier_id || owner_id
      }
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
    |> Multi.run(:low_stock, fn _repo, _ ->
      maybe_notify_low_stock_after_sale(branch.id, business_id, owner_id, priced_items)
    end)
    |> Multi.run(:loyalty, fn _repo, %{sale: sale} ->
      apply_sale_loyalty(sale, business_id, attrs)
    end)
    |> Multi.run(:coupon_redemption, fn _repo, %{sale: sale} ->
      maybe_record_coupon(sale, attrs)
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{sale: sale, khata_ar: inv}} ->
        sale =
          if inv do
            Repo.get!(Sale, sale.id)
          else
            sale
          end

        {:ok, Repo.preload(sale, [:items, :payments, :customer])}

      {:error, :sale, %{errors: errors}, _} ->
        if Keyword.has_key?(errors, :client_txn_id) do
          case Repo.get_by(Sale, client_txn_id: client_txn_id) do
            nil -> {:error, :duplicate_client_txn}
            sale -> {:ok, Repo.preload(sale, [:items, :payments, :customer])}
          end
        else
          {:error, errors}
        end

      {:error, _op, reason, _changes} ->
        {:error, reason}
    end
  end

  defp validate_customer_for_sale(business_id, owner_id, attrs, payments) do
    customer_id = attrs[:customer_id] || attrs["customer_id"]
    khata_total =
      payments
      |> Enum.filter(&(&1.method in ["khata", "credit"]))
      |> Enum.reduce(Decimal.new(0), &Decimal.add(&2, &1.amount))

    cond do
      Decimal.compare(khata_total, 0) == :gt ->
        with %Kaarobar.Schemas.Customer{} = c <-
               Repo.get_by(Kaarobar.Schemas.Customer,
                 id: customer_id,
                 business_id: business_id,
                 owner_id: owner_id
               ),
             true <- c.khata_enabled || {:error, :khata_not_enabled} do
          {:ok, c.id}
        else
          nil -> {:error, :customer_required_for_khata}
          {:error, _} = err -> err
          false -> {:error, :khata_not_enabled}
        end

      is_binary(customer_id) and customer_id != "" ->
        case Repo.get_by(Kaarobar.Schemas.Customer,
               id: customer_id,
               business_id: business_id,
               owner_id: owner_id
             ) do
          nil -> {:error, :customer_not_found}
          c -> {:ok, c.id}
        end

      true ->
        {:ok, nil}
    end
  end

  defp apply_loyalty_redeem(business_id, owner_id, attrs, money) do
    raw = attrs[:loyalty_redeem_points] || attrs["loyalty_redeem_points"] || 0

    points =
      cond do
        is_integer(raw) -> raw
        is_binary(raw) and raw != "" -> String.to_integer(raw)
        true -> 0
      end

    customer_id = attrs[:customer_id] || attrs["customer_id"]

    cond do
      points <= 0 ->
        {:ok, money, 0}

      not is_binary(customer_id) or customer_id == "" ->
        {:error, :customer_required_for_loyalty}

      true ->
        business = Repo.get!(Kaarobar.Schemas.Business, business_id)

        customer =
          Repo.get_by(Kaarobar.Schemas.Customer,
            id: customer_id,
            business_id: business_id,
            owner_id: owner_id
          )

        cond do
          is_nil(customer) ->
            {:error, :customer_not_found}

          points > (customer.loyalty_points || 0) ->
            {:error, :insufficient_loyalty_points}

          true ->
            discount = Kaarobar.Loyalty.redeem_discount(points, business, customer)
            discount = Decimal.min(discount, money.total_amount)
            new_total = Decimal.sub(money.total_amount, discount) |> max_dec(Decimal.new(0)) |> Decimal.round(2)

            new_money = %{
              money
              | discount_amount: Decimal.add(money.discount_amount, discount) |> Decimal.round(2),
                total_amount: new_total
            }

            # Recompute points actually used from discount applied
            redeem_value = Kaarobar.Loyalty.rates(business, customer).redeem_value

            used =
              if Decimal.compare(redeem_value, 0) == :gt do
                discount
                |> Decimal.div(redeem_value)
                |> Decimal.round(0, :floor)
                |> Decimal.to_integer()
              else
                0
              end

            {:ok, new_money, min(used, points)}
        end
    end
  rescue
    ArgumentError -> {:error, :invalid_loyalty_points}
  end

  defp apply_sale_loyalty(sale, business_id, attrs) do
    redeem = attrs[:loyalty_redeem_points] || attrs["loyalty_redeem_points"] || 0
    redeem = if is_integer(redeem), do: redeem, else: 0

    case sale.customer_id do
      nil ->
        {:ok, :skipped}

      customer_id ->
        business = Repo.get!(Kaarobar.Schemas.Business, business_id)
        customer = Repo.get!(Kaarobar.Schemas.Customer, customer_id)
        earned = Kaarobar.Loyalty.earn_points(business, sale.total_amount, customer)
        new_points = max((customer.loyalty_points || 0) - redeem + earned, 0)

        case customer
             |> Kaarobar.Schemas.Customer.changeset(%{loyalty_points: new_points})
             |> Repo.update() do
          {:ok, updated} ->
            {:ok, Kaarobar.Loyalty.maybe_recompute_tier(updated, business_id, sale.owner_id)}

          error ->
            error
        end
    end
  end

  # POS-FR-019 — apply coupon at checkout
  defp apply_coupon(business_id, owner_id, attrs, money) do
    code = attrs[:coupon_code] || attrs["coupon_code"]

    if not is_binary(code) or String.trim(code) == "" do
      {:ok, money, nil, Decimal.new(0)}
    else
      other_discount? = Decimal.compare(money.discount_amount, 0) == :gt

      case Kaarobar.Coupons.validate_and_quote(code, business_id, owner_id, money.total_amount,
             allow_with_other_discounts: not other_discount?
           ) do
        {:ok, coupon, discount} ->
          new_total =
            Decimal.sub(money.total_amount, discount) |> max_dec(Decimal.new(0)) |> Decimal.round(2)

          new_money = %{
            money
            | discount_amount: Decimal.add(money.discount_amount, discount) |> Decimal.round(2),
              total_amount: new_total
          }

          {:ok, new_money, coupon, discount}

        {:error, reason} ->
          {:error, {:coupon_invalid, reason}}
      end
    end
  end

  defp maybe_record_coupon(sale, attrs) do
    coupon = attrs[:applied_coupon] || attrs["applied_coupon"]
    discount = attrs[:coupon_discount] || attrs["coupon_discount"] || Decimal.new(0)

    if is_nil(coupon) or Decimal.compare(to_dec(discount), 0) != :gt do
      {:ok, :skipped}
    else
      case Kaarobar.Coupons.record_redemption(
             coupon,
             sale.id,
             sale.customer_id,
             to_dec(discount)
           ) do
        {:ok, redemption} -> {:ok, redemption}
        {:error, reason} -> {:error, reason}
      end
    end
  end

  defp maybe_create_khata_ar(sale, payments, posted_by_id) do
    khata_amount =
      payments
      |> Enum.filter(&(&1.method in ["khata", "credit"]))
      |> Enum.reduce(Decimal.new(0), &Decimal.add(&2, &1.amount))

    if Decimal.compare(khata_amount, 0) != :gt do
      {:ok, nil}
    else
      # Tracking invoice only — GL is posted via sale journal (AR debit for khata).
      subtotal = sale.subtotal || Decimal.new(0)
      tax = sale.tax_amount || Decimal.new(0)

      {:ok, inv} =
        %Kaarobar.Schemas.ArInvoice{}
        |> Kaarobar.Schemas.ArInvoice.changeset(%{
          owner_id: sale.owner_id,
          business_id: sale.business_id,
          branch_id: sale.branch_id,
          customer_id: sale.customer_id,
          sale_id: sale.id,
          invoice_number: "KH-#{sale.invoice_number}",
          invoice_date: Date.utc_today(),
          due_date: Date.add(Date.utc_today(), 30),
          subtotal: subtotal,
          tax_amount: tax,
          total_amount: khata_amount,
          balance_due: khata_amount,
          status: "open",
          notes: "POS khata · #{sale.invoice_number}"
        })
        |> Repo.insert()

      sale
      |> Sale.changeset(%{ar_invoice_id: inv.id})
      |> Repo.update()

      _ = posted_by_id
      {:ok, inv}
    end
  end

  defp maybe_notify_low_stock_after_sale(branch_id, business_id, owner_id, priced_items) do
    Enum.each(priced_items, fn item ->
      if Map.get(item, :track_inventory) != false do
        Kaarobar.Inventory.maybe_notify_low_stock(
          branch_id,
          item.product_id,
          business_id,
          owner_id
        )
      end
    end)

    {:ok, :checked}
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
    variant_id = raw[:variant_id] || raw["variant_id"] || raw[:product_variant_id] || raw["product_variant_id"]
    modifier_ids = List.wrap(raw[:modifier_ids] || raw["modifier_ids"] || [])
    notes = raw[:notes] || raw["notes"]
    qty = to_dec(raw[:quantity] || raw["quantity"])
    line_discount = to_dec(raw[:discount] || raw["discount"] || 0)

    with %Product{} = product <-
           Repo.get_by(Product, id: product_id, business_id: business_id, owner_id: owner_id),
         true <- product.is_active || {:error, :product_inactive},
         {:ok, variant} <- fetch_variant(variant_id, product, business_id, owner_id),
         {:ok, modifiers} <- fetch_modifiers(modifier_ids, business_id, owner_id),
         unit_price <- line_unit_price(product, branch_id, variant, modifiers, raw),
         true <- Decimal.compare(qty, 0) == :gt || {:error, :invalid_quantity} do
      taxable = max_dec(Decimal.sub(Decimal.mult(qty, unit_price), line_discount), 0)
      tax_rate = product.tax_rate || Decimal.new("0.18")
      tax = Decimal.mult(taxable, tax_rate) |> Decimal.round(2)
      line_total = Decimal.add(taxable, tax) |> Decimal.round(2)

      display_name =
        if variant, do: "#{product.name} (#{variant.name})", else: product.name

      {:ok,
       %{
         product_id: product.id,
         product_variant_id: variant && variant.id,
         sku: (variant && variant.sku) || product.sku,
         name: display_name,
         quantity: qty,
         unit_price: unit_price,
         discount: line_discount,
         tax_rate: tax_rate,
         line_total: line_total,
         taxable: taxable,
         tax: tax,
         track_inventory: product.track_inventory != false,
         modifiers: %{
           "items" =>
             Enum.map(modifiers, fn m ->
               %{"id" => m.id, "name" => m.name, "price_delta" => to_string(m.price_delta)}
             end)
         },
         notes: notes
       }}
    else
      nil -> {:error, {:product_not_found, product_id}}
      {:error, _} = err -> err
      false -> {:error, :product_inactive}
    end
  end

  defp fetch_variant(nil, _product, _, _), do: {:ok, nil}
  defp fetch_variant("", _product, _, _), do: {:ok, nil}

  defp fetch_variant(variant_id, product, business_id, owner_id) do
    case Repo.get_by(ProductVariant,
           id: variant_id,
           product_id: product.id,
           business_id: business_id,
           owner_id: owner_id
         ) do
      nil -> {:error, :variant_not_found}
      %ProductVariant{is_active: false} -> {:error, :variant_inactive}
      variant -> {:ok, variant}
    end
  end

  defp fetch_modifiers([], _, _), do: {:ok, []}

  defp fetch_modifiers(ids, business_id, owner_id) do
    ids = Enum.map(ids, &to_string/1)

    mods =
      from(m in Modifier,
        join: g in assoc(m, :modifier_group),
        where: m.id in ^ids and g.business_id == ^business_id and g.owner_id == ^owner_id and m.is_active == true,
        select: m
      )
      |> Repo.all()

    if length(mods) == length(Enum.uniq(ids)) do
      {:ok, mods}
    else
      {:error, :modifier_not_found}
    end
  end

  defp line_unit_price(product, branch_id, variant, modifiers, raw) do
    base =
      cond do
        variant && variant.price_override ->
          variant.price_override

        true ->
          branch_price(product, branch_id, raw)
      end

    delta =
      Enum.reduce(modifiers, Decimal.new(0), fn m, acc ->
        Decimal.add(acc, m.price_delta || Decimal.new(0))
      end)

    Decimal.add(base, delta)
  end

  defp branch_price(product, branch_id, raw) do
    case Repo.get_by(ProductBranchPrice, product_id: product.id, branch_id: branch_id) do
      %{price: price} ->
        price

      nil ->
        to_dec(raw[:unit_price] || raw["unit_price"] || 0)
    end
  end

  defp compute_totals(items, attrs) do
    cart_discount = to_dec(attrs[:discount_amount] || attrs["discount_amount"] || 0)
    line_discount = Enum.reduce(items, Decimal.new(0), &Decimal.add(&2, &1.discount))
    subtotal_gross = Enum.reduce(items, Decimal.new(0), fn i, acc ->
      Decimal.add(acc, Decimal.mult(i.quantity, i.unit_price))
    end)
    discount_amount = Decimal.add(line_discount, cart_discount)
    subtotal = Decimal.sub(subtotal_gross, line_discount) |> max_dec(Decimal.new(0)) |> Decimal.round(2)
    taxable_after_discount = Decimal.sub(subtotal, cart_discount) |> max_dec(Decimal.new(0)) |> Decimal.round(2)
    tax_after = resolve_tax_amount(items, attrs, subtotal, taxable_after_discount)

    total =
      Decimal.add(taxable_after_discount, tax_after)
      |> Decimal.round(2)

    {:ok,
     %{
       subtotal: subtotal,
       tax_amount: tax_after,
       discount_amount: discount_amount |> Decimal.round(2),
       total_amount: total
     }}
  end

  defp resolve_tax_amount(items, attrs, subtotal, taxable_after_discount) do
    if tax_amount_provided?(attrs) do
      attrs
      |> explicit_tax_amount()
      |> max_dec(Decimal.new(0))
      |> Decimal.round(2)
    else
      auto_tax_amount(items, subtotal, taxable_after_discount)
    end
  end

  defp tax_amount_provided?(attrs) do
    Map.has_key?(attrs, :tax_amount) || Map.has_key?(attrs, "tax_amount")
  end

  defp explicit_tax_amount(attrs) do
    to_dec(Map.get(attrs, :tax_amount, Map.get(attrs, "tax_amount", 0)))
  end

  defp auto_tax_amount(items, subtotal, taxable_after_discount) do
    tax_amount = Enum.reduce(items, Decimal.new(0), &Decimal.add(&2, &1.tax))

    if Decimal.compare(taxable_after_discount, subtotal) == :lt and Decimal.compare(subtotal, 0) == :gt do
      ratio = Decimal.div(taxable_after_discount, subtotal)
      Decimal.mult(tax_amount, ratio) |> Decimal.round(2)
    else
      tax_amount |> Decimal.round(2)
    end
  end

  defp validate_discount_limit(branch, discount_amount, attrs) do
    limit = branch.discount_auto_approve_limit || Decimal.new("0")
    force_pending? = attrs[:requires_discount_approval] == true

    cond do
      Decimal.compare(discount_amount, 0) != :gt ->
        :ok

      force_pending? ->
        _ =
          Kaarobar.Notifications.notify_roles(
            branch.business_id,
            branch.owner_id,
            ["owner", "admin"],
            "discount.approval_needed",
            %{
              branch_id: branch.id,
              discount_amount: to_string(discount_amount),
              limit: to_string(limit)
            },
            title: "Discount needs approval",
            body: "A checkout discount requires approval."
          )

        {:error, :discount_requires_approval}

      Decimal.compare(discount_amount, limit) == :gt ->
        _ =
          Kaarobar.Notifications.notify_roles(
            branch.business_id,
            branch.owner_id,
            ["owner", "admin"],
            "discount.approval_needed",
            %{
              branch_id: branch.id,
              discount_amount: to_string(discount_amount),
              limit: to_string(limit)
            },
            title: "Discount needs approval",
            body: "A checkout discount exceeds the auto-approve limit."
          )

        {:error, {:discount_exceeds_limit, to_string(limit)}}

      true ->
        :ok
    end
  end

  defp normalize_payments(raw_payments, total) do
    payments =
      Enum.map(raw_payments, fn p ->
        method =
          case p[:method] || p["method"] || "cash" do
            "credit" -> "khata"
            other -> other
          end

        amount_raw = p[:amount] || p["amount"]

        %{
          method: method,
          amount:
            if is_nil(amount_raw) or amount_raw == "" do
              :auto
            else
              to_dec(amount_raw)
            end,
          reference: p[:reference] || p["reference"]
        }
      end)

    payments =
      case payments do
        [%{amount: :auto} = p] ->
          [%{p | amount: total}]

        list ->
          Enum.map(list, fn
            %{amount: :auto} = p -> %{p | amount: Decimal.new(0)}
            p -> p
          end)
      end

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

  defp sale_source(attrs) do
    case attrs[:source] || attrs["source"] || "pos" do
      "online" -> "online"
      _ -> "pos"
    end
  end

  defp validate_online_sale(attrs, cashier_id, payments) do
    case sale_source(attrs) do
      "online" ->
        cond do
          not is_nil(cashier_id) and cashier_id != "" ->
            # Online sales should not require a cashier; ignore if provided
            :ok

          Enum.any?(payments, &(&1.method in ["khata", "credit", "cash"])) ->
            {:error, :invalid_online_payment}

          true ->
            :ok
        end

      _ ->
        if is_nil(cashier_id) or cashier_id == "" do
          {:error, :cashier_required}
        else
          :ok
        end
    end
  end

  defp decrement_stock!(branch_id, items) do
    Enum.reduce_while(items, {:ok, :decremented}, fn item, acc ->
      if Map.get(item, :track_inventory) == false do
        {:cont, acc}
      else
        result =
          if Catalog.has_batches?(item.product_id, branch_id) do
            with {:ok, _} <- Catalog.decrement_batches_fefo(item.product_id, branch_id, item.quantity) do
              # Keep inventory_records in sync when batches are used
              from(i in InventoryRecord,
                where: i.branch_id == ^branch_id and i.product_id == ^item.product_id,
                update: [set: [quantity_on_hand: fragment("quantity_on_hand - ?", ^item.quantity)]]
              )
              |> Repo.update_all([])

              {:ok, :decremented}
            end
          else
            {count, _} =
              from(i in InventoryRecord,
                where:
                  i.branch_id == ^branch_id and i.product_id == ^item.product_id and
                    i.quantity_on_hand >= ^item.quantity,
                update: [set: [quantity_on_hand: fragment("quantity_on_hand - ?", ^item.quantity)]]
              )
              |> Repo.update_all([])

            if count == 1, do: {:ok, :decremented}, else: {:error, {:insufficient_stock, item.product_id}}
          end

        case result do
          {:ok, _} -> {:cont, acc}
          {:error, reason} -> {:halt, {:error, reason}}
        end
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
          product_variant_id: Map.get(item, :product_variant_id),
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount,
          tax_rate: item.tax_rate,
          line_total: item.line_total,
          modifiers: Map.get(item, :modifiers) || %{},
          notes: Map.get(item, :notes)
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
    refund_method = attrs[:refund_method] || attrs["refund_method"] || "cash"
    till_id = attrs[:till_id] || attrs["till_id"]

    with %Sale{} = sale <- get_sale(sale_id, owner_id),
         true <- sale.business_id == business_id || {:error, :wrong_business},
         true <- sale.branch_id == branch_id || {:error, :wrong_branch},
         {:ok, branch} <- fetch_branch(branch_id, business_id, owner_id),
         :ok <- validate_return_window(sale, branch),
         :ok <- validate_refund_method(refund_method),
         {:ok, till_id} <- resolve_return_till(branch_id, till_id, refund_method),
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
          till_id: till_id,
          requested_by_id: requested_by_id,
          refund_amount: refund_amount,
          refund_method: refund_method,
          reason: attrs[:reason] || attrs["reason"],
          status: "PendingApproval"
        })
      end)
      |> Multi.run(:items, fn _repo, %{sale_return: sale_return} ->
        insert_return_items(sale_return.id, items)
      end)
      |> Multi.run(:audit_create, fn _repo, %{sale_return: sale_return} ->
        Kaarobar.Audit.log(%{
          owner_id: owner_id,
          user_id: requested_by_id,
          action: "return.create",
          entity_type: "sale_return",
          entity_id: sale_return.id,
          metadata: %{
            sale_id: sale.id,
            refund_amount: to_string(refund_amount),
            status: status
          }
        })
      end)
      |> Multi.run(:finalize, fn _repo, %{sale_return: sale_return} ->
        if status == "Approved" do
          do_finalize_return(
            Repo.preload(sale_return, [:items, :sale]),
            requested_by_id
          )
        else
          {:ok, Repo.preload(sale_return, [:items])}
        end
      end)
      |> Repo.transaction()
      |> case do
        {:ok, %{finalize: result}} ->
          if result.status == "PendingApproval" do
            Kaarobar.Notifications.notify_roles(
              business_id,
              owner_id,
              ["owner", "admin"],
              "return.pending",
              %{return_id: result.id, sale_id: sale_id},
              title: "Return awaiting approval",
              body: "A return of Rs #{result.refund_amount} needs approval."
            )
          end

          {:ok, result}

        {:error, _op, reason, _} ->
          {:error, reason}
      end
    else
      nil -> {:error, :sale_not_found}
      {:error, _} = err -> err
      false -> {:error, :forbidden}
    end
  end

  defp validate_refund_method(method) when method in ~w(cash card wallet), do: :ok
  defp validate_refund_method(_), do: {:error, :invalid_refund_method}

  defp resolve_return_till(_branch_id, till_id, "cash") when is_binary(till_id) and till_id != "" do
    case Repo.get_by(Till, id: till_id, status: "open") do
      nil -> {:error, :till_required_for_cash_refund}
      till -> {:ok, till.id}
    end
  end

  defp resolve_return_till(branch_id, _till_id, "cash") do
    case open_till_for_branch(branch_id) do
      nil -> {:error, :till_required_for_cash_refund}
      till -> {:ok, till.id}
    end
  end

  defp resolve_return_till(_branch_id, till_id, _method) when is_binary(till_id) and till_id != "",
    do: {:ok, till_id}

  defp resolve_return_till(_, _, _), do: {:ok, nil}

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

      sale_return.status != "PendingApproval" ->
        {:error, :invalid_status}

      true ->
        case do_finalize_return(sale_return, approved_by_id) do
          {:ok, ret} ->
            Kaarobar.Audit.log(%{
              owner_id: sale_return.owner_id,
              user_id: approved_by_id,
              action: "return.approve",
              entity_type: "sale_return",
              entity_id: ret.id,
              metadata: %{refund_amount: to_string(ret.refund_amount)}
            })

            if sale_return.requested_by_id do
              Kaarobar.Notifications.notify(
                sale_return.requested_by_id,
                sale_return.owner_id,
                "return.approved",
                %{return_id: ret.id},
                title: "Return approved",
                body: "Your return of Rs #{ret.refund_amount} was approved."
              )
            end

            {:ok, ret}

          err ->
            err
        end
    end
  end

  def reject_return(return_id, rejected_by_id, owner_id, reason \\ nil) do
    sale_return = Repo.get_by(SaleReturn, id: return_id, owner_id: owner_id)

    cond do
      is_nil(sale_return) ->
        {:error, :not_found}

      sale_return.status != "PendingApproval" ->
        {:error, :invalid_status}

      true ->
        Multi.new()
        |> Multi.update(
          :reject,
          SaleReturn.changeset(sale_return, %{
            status: "Rejected",
            rejected_by_id: rejected_by_id,
            rejection_reason: reason
          })
        )
        |> Multi.run(:audit, fn _repo, %{reject: ret} ->
          Kaarobar.Audit.log(%{
            owner_id: owner_id,
            user_id: rejected_by_id,
            action: "return.reject",
            entity_type: "sale_return",
            entity_id: ret.id,
            metadata: %{reason: reason}
          })
        end)
        |> Repo.transaction()
        |> case do
          {:ok, %{reject: ret}} ->
            if sale_return.requested_by_id do
              Kaarobar.Notifications.notify(
                sale_return.requested_by_id,
                owner_id,
                "return.rejected",
                %{return_id: ret.id},
                title: "Return rejected",
                body: reason || "Your return request was rejected."
              )
            end

            {:ok, Repo.preload(ret, [:items])}

          {:error, _op, reason, _} ->
            {:error, reason}
        end
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
        {count, _} =
          from(i in InventoryRecord,
            where: i.branch_id == ^sale_return.branch_id and i.product_id == ^item.product_id,
            update: [
              set: [quantity_on_hand: fragment("quantity_on_hand + ?", ^item.quantity)]
            ]
          )
          |> Repo.update_all([])

        if count == 1 do
          {:cont, acc}
        else
          {:halt, {:error, {:inventory_missing, item.product_id}}}
        end
      end)
    end)
    |> Multi.run(:update_sale_status, fn _repo, _ ->
      update_sale_refund_status(sale_return.sale_id)
    end)
    |> Multi.run(:enqueue_journal, fn _repo, %{approve: ret} ->
      %{
        return_id: ret.id,
        business_id: sale_return.business_id,
        owner_id: sale_return.owner_id,
        posted_by_id: approved_by_id
      }
      |> Kaarobar.Workers.PostReturnJournalWorker.new()
      |> Oban.insert()
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
      Multi.new()
      |> Multi.insert(:till, fn _ ->
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
      end)
      |> Multi.run(:audit, fn _repo, %{till: till} ->
        Kaarobar.Audit.log(%{
          owner_id: owner_id,
          user_id: cashier_id,
          action: "till.open",
          entity_type: "till",
          entity_id: till.id,
          metadata: %{opening_cash: to_string(till.opening_cash), branch_id: branch_id}
        })
      end)
      |> Repo.transaction()
      |> case do
        {:ok, %{till: till}} -> {:ok, till}
        {:error, _op, reason, _} -> {:error, reason}
      end
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
          where:
            r.till_id == ^till_id and r.status == "Approved" and r.refund_method == "cash",
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

      Multi.new()
      |> Multi.update(
        :till,
        Till.changeset(till, %{
          closed_at: DateTime.utc_now() |> DateTime.truncate(:second),
          closing_cash: closing,
          expected_cash: expected,
          over_short: over_short,
          status: "closed"
        })
      )
      |> Multi.run(:audit, fn _repo, %{till: closed} ->
        Kaarobar.Audit.log(%{
          owner_id: owner_id,
          user_id: till.cashier_id,
          action: "till.close",
          entity_type: "till",
          entity_id: closed.id,
          metadata: %{
            expected_cash: to_string(expected),
            closing_cash: to_string(closing),
            over_short: to_string(over_short)
          }
        })
      end)
      |> Repo.transaction()
      |> case do
        {:ok, %{till: closed}} -> {:ok, closed}
        {:error, _op, reason, _} -> {:error, reason}
      end
    else
      {:error, :invalid_till}
    end
  end

  def open_till_for_branch(branch_id) do
    Repo.get_by(Till, branch_id: branch_id, status: "open")
  end

  def list_tills(branch_id, owner_id, business_id) do
    Till
    |> where(
      [t],
      t.branch_id == ^branch_id and t.owner_id == ^owner_id and t.business_id == ^business_id
    )
    |> order_by([t], desc: t.opened_at)
    |> Repo.all()
  end

  def get_till(till_id, owner_id) do
    Repo.get_by(Till, id: till_id, owner_id: owner_id)
  end

  def list_returns(branch_id, owner_id, business_id, opts \\ []) do
    status = Keyword.get(opts, :status)

    query =
      SaleReturn
      |> where(
        [r],
        r.branch_id == ^branch_id and r.owner_id == ^owner_id and r.business_id == ^business_id
      )
      |> order_by([r], desc: r.inserted_at)
      |> preload([:items])

    query =
      if status do
        where(query, [r], r.status == ^status)
      else
        query
      end

    Repo.all(query)
  end

  def list_pending_returns(branch_id, owner_id, business_id) do
    list_returns(branch_id, owner_id, business_id, status: "PendingApproval")
  end

  def get_return(return_id, owner_id) do
    SaleReturn
    |> where([r], r.id == ^return_id and r.owner_id == ^owner_id)
    |> preload([:items, :sale])
    |> Repo.one()
  end

  ## —— Queries ——————————————————————————————————————————————————

  def list_sales(branch_id, owner_id, business_id, opts \\ []) do
    source = opts[:source]

    query =
      Sale
      |> where(
        [s],
        s.owner_id == ^owner_id and s.business_id == ^business_id
      )
      |> then(fn q ->
        if is_binary(branch_id) and branch_id != "" do
          where(q, [s], s.branch_id == ^branch_id)
        else
          q
        end
      end)
      |> then(fn q ->
        if is_binary(source) and source in ~w(pos online) do
          where(q, [s], s.source == ^source)
        else
          q
        end
      end)
      |> order_by([s], desc: s.inserted_at)
      |> preload([:items, :payments, :customer])

    Repo.all(query)
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
  defp to_dec(v) when is_integer(v), do: Decimal.new(v)
  defp to_dec(v) when is_float(v), do: Decimal.from_float(v)

  defp to_dec(v) do
    cleaned =
      "#{v}"
      |> String.trim()
      |> String.replace(",", "")
      |> String.replace(" ", "")

    case cleaned do
      "" -> Decimal.new(0)
      _ -> Decimal.new(cleaned)
    end
  end

  defp max_dec(a, b) do
    if Decimal.compare(a, b) == :lt, do: b, else: a
  end
end
