defmodule Kaarobar.Commissions do
  @moduledoc """
  What staff earn on what they sell.

  ## Accrual happens at the sale and is then frozen

  `accrue_for_sale/2` runs once, when the sale is rung, and copies the rate and
  basis onto every entry it writes. Rates change; recomputing last month's
  commission against this month's rate restates what somebody has already been
  paid, and would silently change again the next time the owner adjusted
  anything.

  ## Who earns it

  The person the sale was *served by*, not the cashier who took the money. In a
  salon those are routinely different people, and paying the till operator for
  the stylist's work is the one mistake that gets noticed immediately.

  ## Narrower rules win

  A rule naming one stylist and one service beats one naming that stylist,
  which beats the shop-wide default. `priority` only breaks ties among rules of
  equal specificity, because "Ayesha gets 40% on colours, 25% on everything
  else" is two rules and neither should have to know about the other.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Audit
  alias Kaarobar.Commissions.Entry
  alias Kaarobar.Commissions.Rule
  alias Kaarobar.Money
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Sales.Sale
  alias Kaarobar.Scope

  # ===========================================================================
  # Rules
  # ===========================================================================

  @doc "The business's commission rules, most specific first."
  @spec list_rules(Scope.t()) :: [Rule.t()]
  def list_rules(%Scope{} = scope) do
    Rule
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> where([rule], rule.is_active)
    |> Repo.all()
    |> Enum.sort_by(&{-Rule.specificity(&1), &1.priority})
  end

  @doc "Fetches a rule."
  @spec fetch_rule(Scope.t(), Ecto.UUID.t()) :: {:ok, Rule.t()} | {:error, :not_found}
  def fetch_rule(%Scope{} = scope, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      Rule
      |> Scoped.for_business(scope)
      |> Scoped.active()
      |> where([rule], rule.id == ^id)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        rule -> {:ok, rule}
      end
    else
      {:error, :not_found}
    end
  end

  @doc "Creates a commission rule."
  @spec create_rule(Scope.t(), map()) :: {:ok, Rule.t()} | {:error, Ecto.Changeset.t()}
  def create_rule(%Scope{} = scope, attrs) do
    %Rule{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope)
    }
    |> Rule.changeset(attrs)
    |> Repo.insert()
  end

  @doc "Updates a rule. Commission already accrued keeps the rate it was paid at."
  @spec update_rule(Scope.t(), Rule.t(), map()) :: {:ok, Rule.t()} | {:error, Ecto.Changeset.t()}
  def update_rule(%Scope{}, %Rule{} = rule, attrs),
    do: rule |> Rule.changeset(attrs) |> Repo.update()

  @doc "Soft-deletes a rule."
  @spec delete_rule(Scope.t(), Rule.t()) :: {:ok, Rule.t()} | {:error, Ecto.Changeset.t()}
  def delete_rule(%Scope{}, %Rule{} = rule),
    do: rule |> Rule.soft_delete_changeset() |> Repo.update()

  # ===========================================================================
  # Accrual
  # ===========================================================================

  @doc """
  Works out and records commission for a sale.

  Call inside the checkout transaction. A sale that commits without its
  commission is a stylist who has to notice and ask.

  Returns `{:ok, []}` when nobody is credited or no rule matches, which is the
  ordinary case for a shop that does not pay commission at all.
  """
  @spec accrue_for_sale(Scope.t(), Sale.t()) :: {:ok, [Entry.t()]} | {:error, term()}
  def accrue_for_sale(%Scope{} = scope, %Sale{} = sale) do
    rules = list_rules(scope)
    earner_id = earner_for(sale)

    cond do
      rules == [] -> {:ok, []}
      is_nil(earner_id) -> {:ok, []}
      true -> write_entries(scope, sale, earner_id, rules)
    end
  end

  @doc """
  Reverses the commission on a sale that was refunded or voided.

  A reversal rather than a deletion: staff notice their pay going down, and
  should be able to see the reversal sitting next to the accrual it undoes.
  """
  @spec reverse_for_sale(Scope.t(), Sale.t(), String.t()) :: {:ok, non_neg_integer()}
  def reverse_for_sale(%Scope{} = scope, %Sale{} = sale, reason) do
    entries =
      Entry
      |> Scoped.for_business(scope)
      |> where([entry], entry.sale_id == ^sale.id)
      |> where([entry], is_nil(entry.reversed_at))
      |> Repo.all()

    Enum.each(entries, fn entry ->
      {:ok, _reversed} = entry |> Entry.reverse_changeset(reason) |> Repo.update()
    end)

    {:ok, length(entries)}
  end

  # ===========================================================================
  # Reporting and payout
  # ===========================================================================

  @doc """
  What one person has earned in a period, with the lines behind it.

  The lines matter as much as the total: "why is my commission short this
  month?" is answered by showing which sales it came from, not by restating the
  figure.
  """
  @spec statement(Scope.t(), Ecto.UUID.t(), Date.t(), Date.t()) :: map()
  def statement(%Scope{} = scope, user_id, from, to) do
    entries =
      Entry
      |> Scoped.for_business(scope)
      |> where([entry], entry.user_id == ^user_id)
      |> where([entry], entry.earned_on >= ^from and entry.earned_on <= ^to)
      |> order_by([entry], asc: entry.earned_on, asc: entry.id)
      |> preload(:sale)
      |> Repo.all()

    payable = Enum.filter(entries, &Entry.payable?/1)

    %{
      user_id: user_id,
      from: from,
      to: to,
      entries: entries,
      earned: payable |> Enum.map(& &1.amount) |> Money.sum(),
      reversed:
        entries
        |> Enum.filter(&(&1.status == "reversed"))
        |> Enum.map(& &1.amount)
        |> Money.sum(),
      paid:
        entries
        |> Enum.filter(&(&1.status == "paid"))
        |> Enum.map(& &1.amount)
        |> Money.sum()
    }
  end

  @doc "What every earner is owed for a period, largest first."
  @spec summary(Scope.t(), Date.t(), Date.t()) :: [map()]
  def summary(%Scope{} = scope, from, to) do
    Entry
    |> Scoped.for_business(scope)
    |> where([entry], entry.earned_on >= ^from and entry.earned_on <= ^to)
    |> where([entry], entry.status in ["accrued", "approved"])
    |> group_by([entry], entry.user_id)
    |> select([entry], %{
      user_id: entry.user_id,
      amount: sum(entry.amount),
      line_count: count(entry.id)
    })
    |> Repo.all()
    |> Enum.map(&%{&1 | amount: Money.to_decimal(&1.amount)})
    |> Enum.sort_by(&Decimal.to_float(&1.amount), :desc)
  end

  @doc "Marks accruals as approved for payment."
  @spec approve(Scope.t(), [Ecto.UUID.t()]) :: {:ok, non_neg_integer()}
  def approve(%Scope{} = scope, entry_ids), do: transition(scope, entry_ids, "approved", nil)

  @doc "Marks approved commission as paid."
  @spec pay(Scope.t(), [Ecto.UUID.t()]) :: {:ok, non_neg_integer()}
  def pay(%Scope{} = scope, entry_ids),
    do: transition(scope, entry_ids, "paid", DateTime.utc_now())

  # ===========================================================================
  # Internal
  # ===========================================================================

  # The person the work was served by, not the cashier who took the money. In a
  # salon those are routinely different people.
  defp earner_for(%Sale{served_by_user_id: id}) when not is_nil(id), do: id
  defp earner_for(%Sale{cashier_id: id}), do: id

  defp write_entries(%Scope{} = scope, %Sale{} = sale, earner_id, rules) do
    sale = Repo.preload(sale, items: [product: :category])
    earned_on = DateTime.to_date(sale.sold_at)

    sale.items
    |> Enum.reduce_while({:ok, []}, fn item, {:ok, acc} ->
      case accrue_line(scope, sale, item, earner_id, rules, earned_on) do
        {:ok, nil} -> {:cont, {:ok, acc}}
        {:ok, entry} -> {:cont, {:ok, [entry | acc]}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, entries} -> finish(scope, sale, Enum.reverse(entries))
      {:error, reason} -> {:error, reason}
    end
  end

  defp accrue_line(%Scope{} = scope, sale, item, earner_id, rules, earned_on) do
    line = %{
      user_id: earner_id,
      variant_id: item.variant_id,
      category_id: item.product && item.product.category_id
    }

    case Enum.find(rules, &Rule.matches?(&1, line)) do
      nil ->
        {:ok, nil}

      rule ->
        {base, amount} =
          Rule.amount_for(rule, %{
            net: item.net_total,
            margin: Money.sub(item.net_total, item.cost_snapshot),
            quantity: item.quantity
          })

        if Money.positive?(amount) do
          insert_entry(scope, sale, item, earner_id, rule, base, amount, earned_on)
        else
          {:ok, nil}
        end
    end
  end

  defp insert_entry(%Scope{} = scope, sale, item, earner_id, rule, base, amount, earned_on) do
    %Entry{}
    |> Entry.changeset(%{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope),
      branch_id: sale.branch_id,
      user_id: earner_id,
      sale_id: sale.id,
      sale_item_id: item.id,
      commission_rule_id: rule.id,
      basis_snapshot: rule.basis,
      rate_snapshot: rule.rate,
      base_amount: base,
      amount: amount,
      earned_on: earned_on
    })
    |> Repo.insert()
  end

  defp finish(%Scope{} = scope, %Sale{} = sale, []), do: {:ok, []} |> tap_audit(scope, sale, 0)

  defp finish(%Scope{} = scope, %Sale{} = sale, entries) do
    {:ok, entries} |> tap_audit(scope, sale, length(entries))
  end

  defp tap_audit(result, _scope, _sale, 0), do: result

  defp tap_audit(result, %Scope{} = scope, %Sale{} = sale, count) do
    Audit.log(scope, "commission.accrued", sale,
      entity_type: "sale",
      label: sale.number,
      summary: "#{count} commission line(s) accrued"
    )

    result
  end

  defp transition(%Scope{} = scope, entry_ids, status, paid_at) do
    updates =
      if paid_at, do: [status: status, paid_at: paid_at], else: [status: status]

    {count, _returned} =
      Entry
      |> Scoped.for_business(scope)
      |> where([entry], entry.id in ^entry_ids)
      |> where([entry], is_nil(entry.reversed_at))
      |> Repo.update_all(set: updates)

    {:ok, count}
  end
end
