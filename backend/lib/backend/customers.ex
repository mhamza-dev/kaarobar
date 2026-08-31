defmodule Kaarobar.Customers do
  @moduledoc """
  Who the shop sells to, and what they owe.

  The customer record and their running balance. What sits alongside it:

    * `Kaarobar.Credit` — which invoices are unpaid, what settled them, ageing.
    * `Kaarobar.Loyalty` — points.
    * `Kaarobar.Prepaid` — store credit and gift cards.

  The split is deliberate. This module answers "what does this customer owe?"
  with one number; `Kaarobar.Credit` answers "owe for what?", which needs the
  invoices and is a different query every time.

  ## The ledger is the truth; the balance is a projection

  `customers.balance` is maintained in the same transaction as the entries that
  move it, under a row lock, exactly as `stock_items.on_hand` mirrors the stock
  ledger and `suppliers.balance` mirrors the purchase one. Five ledgers now
  share this pattern — stock, suppliers, customers, points and prepaid balances
  — so that when any of them is disputed, the answer is the same shape: the
  movements, each with the balance that followed it, and the row where it
  stopped adding up.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Audit
  alias Kaarobar.Customers.Customer
  alias Kaarobar.Customers.CustomerAddress
  alias Kaarobar.Customers.CustomerContact
  alias Kaarobar.Customers.CustomerGroup
  alias Kaarobar.Customers.CustomerNote
  alias Kaarobar.Customers.FollowUp
  alias Kaarobar.Customers.CustomerLedgerEntry
  alias Kaarobar.Customers.CustomerPayment
  alias Kaarobar.Money
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Scope
  alias Kaarobar.Sequences

  # ===========================================================================
  # Customers
  # ===========================================================================

  @doc """
  Builds the customer query, filtered.

  ## Filters

    * `"q"` — matches name, phone, code or email. What a cashier types.
    * `"credit_allowed"` — only those who may buy on account.
    * `"owing"` — only those with an outstanding balance.
  """
  @spec query(Scope.t(), map()) :: Ecto.Query.t()
  def query(%Scope{} = scope, filters \\ %{}) do
    Customer
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> apply_filters(filters)
  end

  @doc "Lists customers, most recently added first."
  @spec list_customers(Scope.t(), map()) :: [Customer.t()]
  def list_customers(%Scope{} = scope, filters \\ %{}) do
    scope
    |> query(filters)
    |> order_by([customer], desc: customer.id)
    |> Repo.all()
  end

  @doc "Fetches one customer."
  @spec fetch_customer(Scope.t(), Ecto.UUID.t()) :: {:ok, Customer.t()} | {:error, :not_found}
  def fetch_customer(%Scope{} = scope, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      Customer
      |> Scoped.for_business(scope)
      |> Scoped.active()
      |> where([customer], customer.id == ^id)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        customer -> {:ok, customer}
      end
    else
      {:error, :not_found}
    end
  end

  @doc """
  Finds a customer by the phone number a cashier typed.

  Phone is how a shop actually identifies a returning customer — not an email,
  and never a UUID.
  """
  @spec find_by_phone(Scope.t(), String.t()) :: Customer.t() | nil
  def find_by_phone(%Scope{} = scope, phone) when is_binary(phone) do
    trimmed = String.trim(phone)

    if trimmed == "" do
      nil
    else
      Customer
      |> Scoped.for_business(scope)
      |> Scoped.active()
      |> where([customer], customer.phone == ^trimmed)
      |> Repo.one()
    end
  end

  @doc """
  Creates a customer.

  An opening balance may be given for a customer who already owed money when
  the shop started using the system; it posts as an `opening` ledger entry so
  the statement begins where reality did.
  """
  @spec create_customer(Scope.t(), map()) :: {:ok, Customer.t()} | {:error, term()}
  def create_customer(%Scope{} = scope, attrs) do
    opening = attrs |> fetch_attr(:opening_balance) |> to_amount()

    Repo.transaction(fn ->
      changeset =
        %Customer{
          organization_id: Scope.organization_id(scope),
          business_id: Scope.business_id(scope)
        }
        |> Customer.changeset(attrs)

      with {:ok, customer} <- Repo.insert(changeset),
           {:ok, customer} <- post_opening_balance(scope, customer, opening) do
        Audit.log(scope, "customer.created", customer,
          entity_type: "customer",
          label: customer.name
        )

        customer
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "Updates a customer's details. The balance is not among them."
  @spec update_customer(Scope.t(), Customer.t(), map()) ::
          {:ok, Customer.t()} | {:error, Ecto.Changeset.t()}
  def update_customer(%Scope{} = scope, %Customer{} = customer, attrs) do
    with {:ok, updated} <- customer |> Customer.changeset(attrs) |> Repo.update() do
      Audit.log(scope, "customer.updated", updated,
        entity_type: "customer",
        label: updated.name,
        changes: %{before: customer, after: updated}
      )

      {:ok, updated}
    end
  end

  @doc """
  Soft-deletes a customer.

  Refused while they still owe money: a debt whose owner has been deleted is a
  debt nobody will collect.
  """
  @spec delete_customer(Scope.t(), Customer.t()) ::
          {:ok, Customer.t()} | {:error, :balance_outstanding | Ecto.Changeset.t()}
  def delete_customer(%Scope{} = scope, %Customer{} = customer) do
    if Money.zero?(customer.balance) do
      with {:ok, deleted} <- customer |> Customer.soft_delete_changeset() |> Repo.update() do
        Audit.log(scope, "customer.deleted", deleted,
          entity_type: "customer",
          label: deleted.name
        )

        {:ok, deleted}
      end
    else
      {:error, :balance_outstanding}
    end
  end

  # ===========================================================================
  # The ledger
  # ===========================================================================

  @doc """
  Writes a ledger entry and moves the customer's balance with it.

  The customer row is locked first, for the same reason a stock item is: the
  entry's `balance_after` has to follow from a value nobody else can change in
  between. Call inside the caller's transaction — a sale posts its debt in the
  same transaction that decrements the stock.

  `amount` is signed: positive increases what is owed.
  """
  @spec record_ledger_entry(Scope.t(), Ecto.UUID.t(), map()) ::
          {:ok, CustomerLedgerEntry.t()} | {:error, term()}
  def record_ledger_entry(%Scope{} = scope, customer_id, attrs) do
    case lock_customer(customer_id) do
      nil ->
        {:error, :not_found}

      %Customer{} = customer ->
        write_entry(scope, customer, attrs)
    end
  end

  @doc """
  Puts a sale on a customer's account, refusing to breach their limit.

  The limit is checked against the *locked* balance rather than one read a
  moment earlier. Two tills selling to the same customer at once would
  otherwise both see room under the limit and both be right, and the shop would
  find out at the end of the month.

  Call inside the checkout transaction: the debt and the stock decrement have
  to land together, or a rollback leaves goods gone and nobody owing for them.
  """
  @spec charge_credit(Scope.t(), Ecto.UUID.t(), Decimal.t(), map()) ::
          {:ok, CustomerLedgerEntry.t()}
          | {:error,
             :not_found
             | :credit_not_allowed
             | {:credit_limit_exceeded, Decimal.t()}
             | Ecto.Changeset.t()}
  def charge_credit(%Scope{} = scope, customer_id, amount, attrs \\ %{}) do
    case lock_customer(customer_id) do
      nil ->
        {:error, :not_found}

      %Customer{} = customer ->
        with :ok <- Customer.credit_check(customer, amount) do
          write_entry(
            scope,
            customer,
            Map.merge(attrs, %{kind: Map.get(attrs, :kind, "sale"), amount: amount})
          )
        end
    end
  end

  @doc "One customer's statement, oldest first."
  @spec list_ledger_entries(Scope.t(), Customer.t(), map()) :: [CustomerLedgerEntry.t()]
  def list_ledger_entries(%Scope{} = scope, %Customer{} = customer, filters \\ %{}) do
    CustomerLedgerEntry
    |> Scoped.for_business(scope)
    |> where([entry], entry.customer_id == ^customer.id)
    |> filter_ledger_dates(filters)
    |> order_by([entry], asc: entry.occurred_at, asc: entry.id)
    |> Repo.all()
  end

  @doc """
  Checks whether a customer may take on more debt, by id.

  Returns the loaded customer so checkout does not have to fetch it twice.
  """
  @spec check_credit(Scope.t(), Ecto.UUID.t(), Decimal.t()) ::
          {:ok, Customer.t()}
          | {:error, :not_found | :credit_not_allowed | {:credit_limit_exceeded, Decimal.t()}}
  def check_credit(%Scope{} = scope, customer_id, amount) do
    with {:ok, customer} <- fetch_customer(scope, customer_id),
         :ok <- Customer.credit_check(customer, amount) do
      {:ok, customer}
    end
  end

  # ===========================================================================
  # Payments against the account
  # ===========================================================================

  @doc """
  Records a customer settling part or all of what they owe.

  Distinct from paying for one sale: this is money against the account, which
  is how most credit is actually collected — a wholesale customer clearing six
  weeks of invoices in one go.

  Pass `shift_id` when the money was taken at a till, so it lands in that
  drawer's count.

  ## Allocating it

  `"allocations"` maps sale ids to amounts, settling named invoices in the same
  transaction that writes the ledger entry. `"auto_allocate" => true` spreads it
  over the oldest invoices instead — a guess, and an explicit one; see
  `Kaarobar.Credit.auto_allocate/2` for why it is not the default.

  Anything unallocated stays as money on account, which is a normal state: a
  customer paying a round figure usually leaves some over.
  """
  @spec record_payment(Scope.t(), Customer.t(), map()) ::
          {:ok, CustomerPayment.t()} | {:error, term()}
  def record_payment(%Scope{} = scope, %Customer{} = customer, attrs) do
    Repo.transaction(fn ->
      amount = attrs |> fetch_attr(:amount) |> to_amount()

      with :ok <- validate_payment_amount(amount),
           {:ok, number} <- Sequences.next(scope, "customer_payment"),
           {:ok, payment} <- insert_payment(scope, customer, attrs, amount, number),
           {:ok, _entry} <- post_payment_entry(scope, customer, payment),
           {:ok, _allocations} <- apply_allocations(scope, payment, attrs) do
        Audit.log(scope, "customer_payment.recorded", payment,
          entity_type: "customer_payment",
          label: payment.number,
          summary: "#{customer.name} paid #{Decimal.to_string(amount, :normal)}"
        )

        payment
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "Fetches one payment, for allocating it afterwards."
  @spec fetch_payment(Scope.t(), Ecto.UUID.t()) ::
          {:ok, CustomerPayment.t()} | {:error, :not_found}
  def fetch_payment(%Scope{} = scope, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      CustomerPayment
      |> Scoped.for_business(scope)
      |> where([payment], payment.id == ^id)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        payment -> {:ok, payment}
      end
    else
      {:error, :not_found}
    end
  end

  @doc "Payments a customer has made, most recent first."
  @spec list_payments(Scope.t(), Customer.t()) :: [CustomerPayment.t()]
  def list_payments(%Scope{} = scope, %Customer{} = customer) do
    CustomerPayment
    |> Scoped.for_business(scope)
    |> where([payment], payment.customer_id == ^customer.id)
    |> order_by([payment], desc: payment.paid_on, desc: payment.id)
    |> Repo.all()
  end

  @doc """
  What is owed, and for how long.

  Buckets are counted from each entry's own date rather than from a statement
  run, because the question a shopkeeper is asking is "how long has this
  particular money been outstanding", not "how old is my report".
  """
  @spec receivables_ageing(Scope.t()) :: map()
  def receivables_ageing(%Scope{} = scope) do
    today = Date.utc_today()

    entries =
      CustomerLedgerEntry
      |> Scoped.for_business(scope)
      |> where([entry], entry.kind in ["sale", "opening"])
      |> preload(:customer)
      |> Repo.all()

    buckets =
      Enum.reduce(entries, empty_ageing(), fn entry, acc ->
        bucket = bucket_for(Date.diff(today, DateTime.to_date(entry.occurred_at)))
        Map.update!(acc, bucket, &Money.add(&1, entry.amount))
      end)

    Map.put(buckets, :total, buckets |> Map.values() |> Money.sum())
  end

  # ===========================================================================
  # Groups
  # ===========================================================================

  @doc "The business's customer groups."
  @spec list_groups(Scope.t()) :: [CustomerGroup.t()]
  def list_groups(%Scope{} = scope) do
    CustomerGroup
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> order_by([group], asc: group.name)
    |> Repo.all()
  end

  @doc "Fetches a group."
  @spec fetch_group(Scope.t(), Ecto.UUID.t()) :: {:ok, CustomerGroup.t()} | {:error, :not_found}
  def fetch_group(%Scope{} = scope, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      CustomerGroup
      |> Scoped.for_business(scope)
      |> Scoped.active()
      |> where([group], group.id == ^id)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        group -> {:ok, group}
      end
    else
      {:error, :not_found}
    end
  end

  @doc "The group new customers fall into, if the shop has named one."
  @spec default_group(Scope.t()) :: CustomerGroup.t() | nil
  def default_group(%Scope{} = scope) do
    CustomerGroup
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> where([group], group.is_default)
    |> Repo.one()
  end

  @doc "Creates a customer group."
  @spec create_group(Scope.t(), map()) :: {:ok, CustomerGroup.t()} | {:error, term()}
  def create_group(%Scope{} = scope, attrs) do
    changeset =
      %CustomerGroup{
        organization_id: Scope.organization_id(scope),
        business_id: Scope.business_id(scope)
      }
      |> CustomerGroup.changeset(attrs)

    with {:ok, group} <- Repo.insert(changeset) do
      Audit.log(scope, "customer_group.created", group,
        entity_type: "customer_group",
        label: group.name
      )

      {:ok, group}
    end
  end

  @doc "Updates a group. Members inherit the change immediately."
  @spec update_group(Scope.t(), CustomerGroup.t(), map()) ::
          {:ok, CustomerGroup.t()} | {:error, Ecto.Changeset.t()}
  def update_group(%Scope{} = scope, %CustomerGroup{} = group, attrs) do
    with {:ok, updated} <- group |> CustomerGroup.changeset(attrs) |> Repo.update() do
      Audit.log(scope, "customer_group.updated", updated,
        entity_type: "customer_group",
        label: updated.name,
        changes: %{before: group, after: updated}
      )

      {:ok, updated}
    end
  end

  @doc """
  Soft-deletes a group.

  Members are left pointing at nothing rather than being moved: silently
  reassigning a hundred trade buyers to retail prices because someone tidied up
  a group is not a cleanup, it is a pricing incident.
  """
  @spec delete_group(Scope.t(), CustomerGroup.t()) ::
          {:ok, CustomerGroup.t()} | {:error, Ecto.Changeset.t()}
  def delete_group(%Scope{} = scope, %CustomerGroup{} = group) do
    with {:ok, deleted} <- group |> CustomerGroup.soft_delete_changeset() |> Repo.update() do
      Audit.log(scope, "customer_group.deleted", deleted,
        entity_type: "customer_group",
        label: deleted.name
      )

      {:ok, deleted}
    end
  end

  # ===========================================================================
  # Addresses and contacts
  # ===========================================================================

  @doc "A customer's addresses, the default one first."
  @spec list_addresses(Scope.t(), Customer.t()) :: [CustomerAddress.t()]
  def list_addresses(%Scope{} = scope, %Customer{} = customer) do
    CustomerAddress
    |> Scoped.for_business(scope)
    |> where([address], address.customer_id == ^customer.id)
    |> order_by([address], desc: address.is_default, asc: address.id)
    |> Repo.all()
  end

  @doc """
  Adds an address.

  The first one is made the default automatically — a customer with exactly one
  address and no default is a state that only ever causes a delivery to ask
  which address it should go to.
  """
  @spec add_address(Scope.t(), Customer.t(), map()) ::
          {:ok, CustomerAddress.t()} | {:error, term()}
  def add_address(%Scope{} = scope, %Customer{} = customer, attrs) do
    Repo.transaction(fn ->
      first? = list_addresses(scope, customer) == []

      attrs =
        attrs
        |> stringify()
        |> Map.merge(%{
          "business_id" => Scope.business_id(scope),
          "customer_id" => customer.id
        })
        |> then(&if first?, do: Map.put(&1, "is_default", true), else: &1)

      if truthy?(Map.get(attrs, "is_default")) do
        clear_default(CustomerAddress, customer.id, nil, :is_default)
      end

      case %CustomerAddress{} |> CustomerAddress.changeset(attrs) |> Repo.insert() do
        {:ok, address} -> address
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "Updates an address."
  @spec update_address(Scope.t(), CustomerAddress.t(), map()) ::
          {:ok, CustomerAddress.t()} | {:error, term()}
  def update_address(%Scope{}, %CustomerAddress{} = address, attrs) do
    Repo.transaction(fn ->
      if truthy?(fetch_attr(attrs, :is_default)) do
        clear_default(CustomerAddress, address.customer_id, address.id, :is_default)
      end

      case address |> CustomerAddress.changeset(stringify(attrs)) |> Repo.update() do
        {:ok, updated} -> updated
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "Removes an address."
  @spec delete_address(Scope.t(), CustomerAddress.t()) ::
          {:ok, CustomerAddress.t()} | {:error, Ecto.Changeset.t()}
  def delete_address(%Scope{}, %CustomerAddress{} = address), do: Repo.delete(address)

  @doc "A customer's contacts, the primary one first."
  @spec list_contacts(Scope.t(), Customer.t()) :: [CustomerContact.t()]
  def list_contacts(%Scope{} = scope, %Customer{} = customer) do
    CustomerContact
    |> Scoped.for_business(scope)
    |> where([contact], contact.customer_id == ^customer.id)
    |> order_by([contact], desc: contact.is_primary, asc: contact.name)
    |> Repo.all()
  end

  @doc "Adds a contact. The first becomes the primary one."
  @spec add_contact(Scope.t(), Customer.t(), map()) ::
          {:ok, CustomerContact.t()} | {:error, term()}
  def add_contact(%Scope{} = scope, %Customer{} = customer, attrs) do
    Repo.transaction(fn ->
      first? = list_contacts(scope, customer) == []

      attrs =
        attrs
        |> stringify()
        |> Map.merge(%{
          "business_id" => Scope.business_id(scope),
          "customer_id" => customer.id
        })
        |> then(&if first?, do: Map.put(&1, "is_primary", true), else: &1)

      if truthy?(Map.get(attrs, "is_primary")) do
        clear_default(CustomerContact, customer.id, nil, :is_primary)
      end

      case %CustomerContact{} |> CustomerContact.changeset(attrs) |> Repo.insert() do
        {:ok, contact} -> contact
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "Updates a contact."
  @spec update_contact(Scope.t(), CustomerContact.t(), map()) ::
          {:ok, CustomerContact.t()} | {:error, term()}
  def update_contact(%Scope{}, %CustomerContact{} = contact, attrs) do
    Repo.transaction(fn ->
      if truthy?(fetch_attr(attrs, :is_primary)) do
        clear_default(CustomerContact, contact.customer_id, contact.id, :is_primary)
      end

      case contact |> CustomerContact.changeset(stringify(attrs)) |> Repo.update() do
        {:ok, updated} -> updated
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "Removes a contact."
  @spec delete_contact(Scope.t(), CustomerContact.t()) ::
          {:ok, CustomerContact.t()} | {:error, Ecto.Changeset.t()}
  def delete_contact(%Scope{}, %CustomerContact{} = contact), do: Repo.delete(contact)

  @doc "Fetches one address, contact or note by id, within this business."
  @spec fetch_child(Scope.t(), module(), Ecto.UUID.t()) :: {:ok, struct()} | {:error, :not_found}
  def fetch_child(%Scope{} = scope, schema, id)
      when schema in [CustomerAddress, CustomerContact, CustomerNote] do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      schema
      |> Scoped.for_business(scope)
      |> where([record], record.id == ^id)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        record -> {:ok, record}
      end
    else
      {:error, :not_found}
    end
  end

  # ===========================================================================
  # Notes and follow-ups
  # ===========================================================================

  @doc "A customer's notes, pinned first, then newest."
  @spec list_notes(Scope.t(), Customer.t()) :: [CustomerNote.t()]
  def list_notes(%Scope{} = scope, %Customer{} = customer) do
    CustomerNote
    |> Scoped.for_business(scope)
    |> where([note], note.customer_id == ^customer.id)
    |> order_by([note], desc: note.is_pinned, desc: note.inserted_at)
    |> Repo.all()
  end

  @doc "Adds a note, stamped with who wrote it."
  @spec add_note(Scope.t(), Customer.t(), map()) :: {:ok, CustomerNote.t()} | {:error, term()}
  def add_note(%Scope{} = scope, %Customer{} = customer, attrs) do
    attrs =
      attrs
      |> stringify()
      |> Map.merge(%{
        "business_id" => Scope.business_id(scope),
        "customer_id" => customer.id,
        "author_user_id" => Scope.user_id(scope),
        "author_label" => scope.user && scope.user.name
      })

    %CustomerNote{} |> CustomerNote.changeset(attrs) |> Repo.insert()
  end

  @doc "Removes a note."
  @spec delete_note(Scope.t(), CustomerNote.t()) ::
          {:ok, CustomerNote.t()} | {:error, Ecto.Changeset.t()}
  def delete_note(%Scope{}, %CustomerNote{} = note), do: Repo.delete(note)

  @doc """
  Follow-ups, filtered.

  ## Filters

    * `"status"` — defaults to `"open"`, because a list of finished tasks is
      not what anyone opens this for.
    * `"customer_id"`, `"assigned_to_id"`
    * `"due_before"` — a `Date`. What is due today, or overdue.
  """
  @spec list_follow_ups(Scope.t(), map()) :: [FollowUp.t()]
  def list_follow_ups(%Scope{} = scope, filters \\ %{}) do
    FollowUp
    |> Scoped.for_business(scope)
    |> apply_follow_up_filters(filters)
    |> order_by([task], asc: task.due_on, asc: task.id)
    |> preload(:customer)
    |> Repo.all()
  end

  @doc "Fetches a follow-up."
  @spec fetch_follow_up(Scope.t(), Ecto.UUID.t()) :: {:ok, FollowUp.t()} | {:error, :not_found}
  def fetch_follow_up(%Scope{} = scope, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      FollowUp
      |> Scoped.for_business(scope)
      |> where([task], task.id == ^id)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        task -> {:ok, task}
      end
    else
      {:error, :not_found}
    end
  end

  @doc "Books something to be done about a customer."
  @spec create_follow_up(Scope.t(), Customer.t(), map()) ::
          {:ok, FollowUp.t()} | {:error, Ecto.Changeset.t()}
  def create_follow_up(%Scope{} = scope, %Customer{} = customer, attrs) do
    attrs =
      attrs
      |> stringify()
      |> Map.merge(%{
        "organization_id" => Scope.organization_id(scope),
        "business_id" => Scope.business_id(scope),
        "customer_id" => customer.id,
        "created_by_id" => Scope.user_id(scope)
      })

    %FollowUp{} |> FollowUp.changeset(attrs) |> Repo.insert()
  end

  @doc "Updates an open follow-up."
  @spec update_follow_up(Scope.t(), FollowUp.t(), map()) ::
          {:ok, FollowUp.t()} | {:error, Ecto.Changeset.t()}
  def update_follow_up(%Scope{}, %FollowUp{} = task, attrs),
    do: task |> FollowUp.changeset(stringify(attrs)) |> Repo.update()

  @doc "Closes a follow-up with what came of it."
  @spec complete_follow_up(Scope.t(), FollowUp.t(), String.t()) ::
          {:ok, FollowUp.t()} | {:error, Ecto.Changeset.t()}
  def complete_follow_up(%Scope{} = scope, %FollowUp{} = task, outcome) do
    task
    |> FollowUp.complete_changeset(Scope.user_id(scope), outcome)
    |> Repo.update()
  end

  @doc "Abandons a follow-up without doing it."
  @spec cancel_follow_up(Scope.t(), FollowUp.t(), String.t()) ::
          {:ok, FollowUp.t()} | {:error, Ecto.Changeset.t()}
  def cancel_follow_up(%Scope{} = scope, %FollowUp{} = task, reason) do
    task
    |> FollowUp.cancel_changeset(Scope.user_id(scope), reason)
    |> Repo.update()
  end

  # ===========================================================================
  # Internal
  # ===========================================================================

  # Both entry points arrive here with the customer row already locked, so
  # `balance_after` follows from a value nobody else can change in between.
  defp write_entry(%Scope{} = scope, %Customer{} = customer, attrs) do
    amount = attrs |> Map.fetch!(:amount) |> Money.to_decimal()
    balance_after = Money.add(customer.balance, amount)

    entry_attrs =
      Map.merge(attrs, %{
        organization_id: Scope.organization_id(scope),
        business_id: Scope.business_id(scope),
        branch_id: Map.get(attrs, :branch_id) || Scope.branch_id(scope),
        customer_id: customer.id,
        amount: amount,
        balance_after: balance_after,
        occurred_at: Map.get(attrs, :occurred_at) || DateTime.utc_now(),
        actor_user_id: Scope.user_id(scope),
        actor_label: scope.user && scope.user.name
      })

    with {:ok, entry} <-
           %CustomerLedgerEntry{} |> CustomerLedgerEntry.changeset(entry_attrs) |> Repo.insert(),
         {:ok, _customer} <-
           customer |> Customer.balance_changeset(balance_after) |> Repo.update() do
      {:ok, entry}
    end
  end

  defp lock_customer(customer_id) do
    Customer
    |> where([customer], customer.id == ^customer_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  defp post_opening_balance(_scope, customer, nil), do: {:ok, customer}

  defp post_opening_balance(%Scope{} = scope, %Customer{} = customer, amount) do
    if Money.zero?(amount) do
      {:ok, customer}
    else
      with {:ok, _entry} <-
             record_ledger_entry(scope, customer.id, %{
               kind: "opening",
               amount: amount,
               reference_type: "customer",
               reference_id: customer.id,
               note: "Opening balance"
             }) do
        {:ok, %{customer | balance: Money.round(amount)}}
      end
    end
  end

  defp validate_payment_amount(nil), do: {:error, :amount_required}

  defp validate_payment_amount(amount) do
    if Money.positive?(amount), do: :ok, else: {:error, :amount_must_be_positive}
  end

  defp insert_payment(%Scope{} = scope, %Customer{} = customer, attrs, amount, number) do
    payment_attrs = %{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope),
      branch_id: Scope.branch_id(scope),
      customer_id: customer.id,
      number: number,
      method: fetch_attr(attrs, :method) || "cash",
      amount: amount,
      paid_on: fetch_attr(attrs, :paid_on),
      reference: fetch_attr(attrs, :reference),
      notes: fetch_attr(attrs, :notes),
      created_by_id: Scope.user_id(scope),
      shift_id: fetch_attr(attrs, :shift_id)
    }

    %CustomerPayment{} |> CustomerPayment.changeset(payment_attrs) |> Repo.insert()
  end

  # Runs inside the caller's transaction, so a bad allocation takes the payment
  # with it rather than leaving money recorded against the wrong invoice.
  defp apply_allocations(%Scope{} = scope, %CustomerPayment{} = payment, attrs) do
    explicit = fetch_attr(attrs, :allocations)

    cond do
      is_map(explicit) and map_size(explicit) > 0 ->
        Kaarobar.Credit.allocate_within(scope, payment, explicit)

      fetch_attr(attrs, :auto_allocate) == true ->
        invoices = Kaarobar.Credit.open_invoices(scope, customer_id: payment.customer_id)
        Kaarobar.Credit.allocate_within(scope, payment, spread_oldest_first(invoices, payment))

      true ->
        {:ok, []}
    end
  end

  defp spread_oldest_first(invoices, %CustomerPayment{amount: amount}) do
    {plan, _left} =
      Enum.reduce(invoices, {%{}, amount}, fn invoice, {acc, remaining} ->
        take = Money.min(invoice.outstanding, remaining)

        if Money.positive?(take) do
          {Map.put(acc, invoice.sale_id, take), Money.sub(remaining, take)}
        else
          {acc, remaining}
        end
      end)

    plan
  end

  defp post_payment_entry(%Scope{} = scope, %Customer{} = customer, %CustomerPayment{} = payment) do
    record_ledger_entry(scope, customer.id, %{
      kind: "payment",
      amount: Decimal.negate(payment.amount),
      reference_type: "customer_payment",
      reference_id: payment.id,
      note: "Payment #{payment.number}",
      occurred_at: DateTime.new!(payment.paid_on, ~T[00:00:00.000000], "Etc/UTC")
    })
  end

  defp apply_filters(query, filters) do
    Enum.reduce(filters, query, fn
      {"q", term}, acc when is_binary(term) and term != "" ->
        pattern = "%#{String.trim(term)}%"

        where(
          acc,
          [customer],
          ilike(customer.name, ^pattern) or ilike(customer.phone, ^pattern) or
            ilike(customer.code, ^pattern) or ilike(customer.email, ^pattern)
        )

      {"credit_allowed", true}, acc ->
        where(acc, [customer], customer.credit_allowed)

      {"owing", true}, acc ->
        where(acc, [customer], customer.balance > 0)

      _other, acc ->
        acc
    end)
  end

  defp filter_ledger_dates(query, %{"from" => %Date{} = from}),
    do: where(query, [entry], fragment("?::date", entry.occurred_at) >= ^from)

  defp filter_ledger_dates(query, _filters), do: query

  defp empty_ageing do
    zero = Money.zero()
    %{current: zero, days_30: zero, days_60: zero, days_90: zero, days_over_90: zero}
  end

  defp bucket_for(days) when days <= 0, do: :current
  defp bucket_for(days) when days <= 30, do: :days_30
  defp bucket_for(days) when days <= 60, do: :days_60
  defp bucket_for(days) when days <= 90, do: :days_90
  defp bucket_for(_days), do: :days_over_90

  # Only one address may be the default and only one contact primary, and the
  # database enforces it with a partial unique index — so the old holder has to
  # be stood down in the same transaction, not after the insert fails.
  defp clear_default(schema, customer_id, except_id, field) do
    query = from record in schema, where: record.customer_id == ^customer_id

    query = if except_id, do: where(query, [r], r.id != ^except_id), else: query

    Repo.update_all(query, set: [{field, false}])
    :ok
  end

  defp apply_follow_up_filters(query, filters) do
    status = Map.get(filters, "status", "open")

    query = if status in ["all", nil], do: query, else: where(query, [t], t.status == ^status)

    Enum.reduce(filters, query, fn
      {"customer_id", id}, acc when is_binary(id) -> where(acc, [t], t.customer_id == ^id)
      {"assigned_to_id", id}, acc when is_binary(id) -> where(acc, [t], t.assigned_to_id == ^id)
      {"due_before", %Date{} = on}, acc -> where(acc, [t], t.due_on <= ^on)
      _other, acc -> acc
    end)
  end

  defp stringify(attrs) when is_map(attrs) do
    Map.new(attrs, fn {key, value} ->
      {if(is_atom(key), do: Atom.to_string(key), else: key), value}
    end)
  end

  defp truthy?(true), do: true
  defp truthy?("true"), do: true
  defp truthy?(_other), do: false

  # Controllers hand over string keys; internal callers use atoms. Accepting
  # both here is cheaper than making every caller normalise first.
  defp fetch_attr(attrs, key) when is_map(attrs) and is_atom(key),
    do: Map.get(attrs, key) || Map.get(attrs, Atom.to_string(key))

  defp fetch_attr(_attrs, _key), do: nil

  defp to_amount(nil), do: nil

  defp to_amount(value) do
    case Money.cast(value) do
      {:ok, amount} -> amount
      :error -> nil
    end
  end
end
