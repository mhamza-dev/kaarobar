defmodule KaarobarWeb.CrmSerializers do
  @moduledoc """
  JSON shapes for the customer relationship surfaces: groups, addresses,
  contacts, notes, follow-ups, credit, points and prepaid balances.

  Money is a string everywhere, as it is throughout the API — a JSON number
  round-trips through a float in most clients, and a receipt that reads 340.29
  because 340.30 could not be represented is a support call.

  A gift card is never serialised with its code. Only the masked tail goes out,
  because the code is the money.
  """

  alias Kaarobar.Customers.CustomerAddress
  alias Kaarobar.Customers.CustomerContact
  alias Kaarobar.Customers.CustomerGroup
  alias Kaarobar.Customers.CustomerNote
  alias Kaarobar.Customers.FollowUp
  alias Kaarobar.Customers.PaymentAllocation
  alias Kaarobar.Loyalty.Account
  alias Kaarobar.Loyalty.Program
  alias Kaarobar.Loyalty.Transaction
  alias Kaarobar.Prepaid.GiftCard
  alias Kaarobar.Prepaid.GiftCardTransaction
  alias Kaarobar.Prepaid.StoreCredit
  alias Kaarobar.Prepaid.StoreCreditTransaction
  alias KaarobarWeb.JSONHelpers, as: H
  alias KaarobarWeb.SalesSerializers

  # --- Groups -----------------------------------------------------------------

  def group(%CustomerGroup{} = group) do
    %{
      id: group.id,
      name: group.name,
      code: group.code,
      description: group.description,
      price_list_id: group.price_list_id,
      discount_percent: H.money(group.discount_percent),
      payment_terms_days: group.payment_terms_days,
      credit_limit: H.money(group.credit_limit),
      credit_allowed: group.credit_allowed,
      loyalty_multiplier: H.money(group.loyalty_multiplier),
      is_default: group.is_default,
      is_active: group.is_active
    }
  end

  # --- Addresses and contacts -------------------------------------------------

  def address(%CustomerAddress{} = address) do
    %{
      id: address.id,
      customer_id: address.customer_id,
      label: address.label,
      kind: address.kind,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      postal_code: address.postal_code,
      country_code: address.country_code,
      latitude: H.money(address.latitude),
      longitude: H.money(address.longitude),
      delivery_notes: address.delivery_notes,
      is_default: address.is_default,
      one_line: CustomerAddress.one_line(address)
    }
  end

  def contact(%CustomerContact{} = contact) do
    %{
      id: contact.id,
      customer_id: contact.customer_id,
      name: contact.name,
      role: contact.role,
      phone: contact.phone,
      email: contact.email,
      notes: contact.notes,
      is_primary: contact.is_primary
    }
  end

  # --- Notes and follow-ups ---------------------------------------------------

  def note(%CustomerNote{} = note) do
    %{
      id: note.id,
      customer_id: note.customer_id,
      body: note.body,
      is_pinned: note.is_pinned,
      author_label: note.author_label,
      inserted_at: H.timestamp(note.inserted_at)
    }
  end

  def follow_up(%FollowUp{} = task) do
    today = Date.utc_today()

    %{
      id: task.id,
      customer_id: task.customer_id,
      customer: H.preloaded(task.customer, &SalesSerializers.customer/1),
      title: task.title,
      body: task.body,
      kind: task.kind,
      status: task.status,
      due_on: H.date(task.due_on),
      overdue: FollowUp.overdue?(task, today),
      assigned_to_id: task.assigned_to_id,
      completed_at: H.timestamp(task.completed_at),
      outcome: task.outcome
    }
  end

  # --- Credit -----------------------------------------------------------------

  @doc "One unpaid invoice, as the ageing report sees it."
  def invoice(invoice) when is_map(invoice) do
    %{
      sale_id: invoice.sale_id,
      number: invoice.number,
      customer_id: invoice.customer_id,
      customer_name: Map.get(invoice, :customer_name),
      sold_at: H.timestamp(invoice.sold_at),
      due_on: H.date(invoice.due_on),
      charged: H.money(invoice.charged),
      allocated: H.money(invoice.allocated),
      outstanding: H.money(invoice.outstanding),
      days_overdue: invoice.days_overdue
    }
  end

  def allocation(%PaymentAllocation{} = allocation) do
    %{
      id: allocation.id,
      customer_payment_id: allocation.customer_payment_id,
      sale_id: allocation.sale_id,
      amount: H.money(allocation.amount),
      note: allocation.note,
      payment: H.preloaded(allocation.customer_payment, &SalesSerializers.customer_payment/1)
    }
  end

  @doc "The ageing buckets, counted against each customer's own terms."
  def ageing(buckets) do
    %{
      current: H.money(buckets.current),
      days_1_30: H.money(buckets.days_1_30),
      days_31_60: H.money(buckets.days_31_60),
      days_61_90: H.money(buckets.days_61_90),
      days_over_90: H.money(buckets.days_over_90),
      total: H.money(buckets.total),
      as_of: H.date(Map.get(buckets, :as_of)),
      invoice_count: Map.get(buckets, :invoice_count)
    }
  end

  def customer_ageing(row) do
    row
    |> ageing()
    |> Map.merge(%{
      customer_id: row.customer_id,
      customer_name: row.customer_name,
      oldest_days_overdue: row.oldest_days_overdue
    })
  end

  def statement(statement) do
    %{
      customer: SalesSerializers.customer(statement.customer),
      balance: H.money(statement.balance),
      outstanding: H.money(statement.outstanding),
      credit_limit: H.money(statement.credit_limit),
      available_credit: available_credit(statement.available_credit),
      entries: Enum.map(statement.entries, &SalesSerializers.customer_ledger_entry/1),
      open_invoices: Enum.map(statement.open_invoices, &invoice/1)
    }
  end

  # --- Loyalty ----------------------------------------------------------------

  def program(%Program{} = program) do
    %{
      id: program.id,
      name: program.name,
      points_label: program.points_label,
      earn_rate: H.money(program.earn_rate),
      redeem_rate: H.money(program.redeem_rate),
      min_points_to_redeem: program.min_points_to_redeem,
      max_redeem_percent: H.money(program.max_redeem_percent),
      points_expire_after_days: program.points_expire_after_days,
      earn_on_discounted: program.earn_on_discounted,
      earn_on_tax: program.earn_on_tax,
      is_active: program.is_active
    }
  end

  def loyalty_account(%Account{} = account) do
    %{
      id: account.id,
      customer_id: account.customer_id,
      loyalty_program_id: account.loyalty_program_id,
      points_balance: account.points_balance,
      lifetime_earned: account.lifetime_earned,
      lifetime_redeemed: account.lifetime_redeemed,
      tier: account.tier,
      enrolled_at: H.timestamp(account.enrolled_at),
      last_activity_at: H.timestamp(account.last_activity_at)
    }
  end

  def loyalty_transaction(%Transaction{} = entry) do
    %{
      id: entry.id,
      kind: entry.kind,
      points: entry.points,
      balance_after: entry.balance_after,
      value_amount: H.money(entry.value_amount),
      reference_type: entry.reference_type,
      reference_id: entry.reference_id,
      note: entry.note,
      expires_on: H.date(entry.expires_on),
      occurred_at: H.timestamp(entry.occurred_at)
    }
  end

  # --- Prepaid ----------------------------------------------------------------

  def store_credit(%StoreCredit{} = credit) do
    %{
      id: credit.id,
      number: credit.number,
      customer_id: credit.customer_id,
      currency: credit.currency,
      issued_amount: H.money(credit.issued_amount),
      balance: H.money(credit.balance),
      spent: H.money(StoreCredit.spent(credit)),
      reason: credit.reason,
      reference_type: credit.reference_type,
      reference_id: credit.reference_id,
      issued_at: H.timestamp(credit.issued_at),
      expires_on: H.date(credit.expires_on),
      voided_at: H.timestamp(credit.voided_at),
      spendable: StoreCredit.spendable?(credit, Date.utc_today())
    }
  end

  def store_credit_transaction(%StoreCreditTransaction{} = entry) do
    %{
      id: entry.id,
      kind: entry.kind,
      amount: H.money(entry.amount),
      balance_after: H.money(entry.balance_after),
      reference_type: entry.reference_type,
      reference_id: entry.reference_id,
      note: entry.note,
      occurred_at: H.timestamp(entry.occurred_at)
    }
  end

  @doc """
  A gift card, without its code.

  `code` is virtual and set only on the response to the call that created the
  card — see `issued_gift_card/1`. Everywhere else the card goes out masked,
  because anything that can read a card's code can spend it.
  """
  def gift_card(%GiftCard{} = card) do
    %{
      id: card.id,
      masked_code: GiftCard.masked(card),
      currency: card.currency,
      issued_amount: H.money(card.issued_amount),
      balance: H.money(card.balance),
      status: card.status,
      customer_id: card.customer_id,
      recipient_name: card.recipient_name,
      message: card.message,
      issued_at: H.timestamp(card.issued_at),
      expires_on: H.date(card.expires_on),
      activated_at: H.timestamp(card.activated_at),
      spendable: GiftCard.spendable?(card, Date.utc_today())
    }
  end

  @doc """
  The one response that carries the code.

  Returned only from issuing, and only once: the plaintext is never stored, so
  a client that does not capture it here cannot get it again.
  """
  def issued_gift_card(%GiftCard{} = card),
    do: card |> gift_card() |> Map.put(:code, card.code)

  def gift_card_transaction(%GiftCardTransaction{} = entry) do
    %{
      id: entry.id,
      kind: entry.kind,
      amount: H.money(entry.amount),
      balance_after: H.money(entry.balance_after),
      reference_type: entry.reference_type,
      reference_id: entry.reference_id,
      branch_id: entry.branch_id,
      note: entry.note,
      occurred_at: H.timestamp(entry.occurred_at)
    }
  end

  # An unlimited line of credit is `:unlimited`, not a number — serialising it
  # as a very large figure would have a client render it.
  defp available_credit(:unlimited), do: nil
  defp available_credit(amount), do: H.money(amount)
end
