defmodule Kaarobar.Registers do
  @moduledoc """
  Tills, the shifts worked on them, and the cash that moves in and out.

  ## Why running totals rather than a query at close

  A shift accumulates `gross_sales`, `tender_totals` and the rest as sales are
  rung, so a mid-shift X report costs nothing and the close is instant. The
  alternative — summing every sale on the register at close — gets slower every
  day, and the busiest moment of a shop's evening is exactly when the cashier
  is waiting to go home.

  The running totals are updated inside the same transaction as the sale that
  moved them, so they cannot drift from the sales they summarise. `Kaarobar
  .Registers.reconcile_shift/2` recomputes from the sales anyway, for anyone
  who wants to check.

  ## One open shift per register

  Enforced by a partial unique index, not by a check-then-write. Two open
  shifts would mean sales landing in whichever the code happened to pick, and
  neither drawer ever balancing.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Audit
  alias Kaarobar.Money
  alias Kaarobar.Registers.CashMovement
  alias Kaarobar.Registers.Register
  alias Kaarobar.Registers.Shift
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Sales.Payment
  alias Kaarobar.Sales.Sale
  alias Kaarobar.Scope
  alias Kaarobar.Sequences

  # ===========================================================================
  # Registers
  # ===========================================================================

  @doc "Lists the tills a scope can see."
  @spec list_registers(Scope.t(), map()) :: [Register.t()]
  def list_registers(%Scope{} = scope, filters \\ %{}) do
    Register
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> Scoped.within_branches(scope)
    |> filter_branch(filters)
    |> order_by([register], asc: register.name)
    |> Repo.all()
  end

  @doc "Fetches a till."
  @spec fetch_register(Scope.t(), Ecto.UUID.t()) :: {:ok, Register.t()} | {:error, :not_found}
  def fetch_register(%Scope{} = scope, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      Register
      |> Scoped.for_business(scope)
      |> Scoped.active()
      |> where([register], register.id == ^id)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        register -> {:ok, register}
      end
    else
      {:error, :not_found}
    end
  end

  @doc "Creates a till at a branch."
  @spec create_register(Scope.t(), map()) :: {:ok, Register.t()} | {:error, Ecto.Changeset.t()}
  def create_register(%Scope{} = scope, attrs) do
    changeset =
      %Register{
        organization_id: Scope.organization_id(scope),
        business_id: Scope.business_id(scope)
      }
      |> Register.changeset(put_default_branch(scope, attrs))

    with {:ok, register} <- Repo.insert(changeset) do
      Audit.log(scope, "register.created", register,
        entity_type: "register",
        label: register.name
      )

      {:ok, register}
    end
  end

  @doc "Updates a till."
  @spec update_register(Scope.t(), Register.t(), map()) ::
          {:ok, Register.t()} | {:error, Ecto.Changeset.t()}
  def update_register(%Scope{} = scope, %Register{} = register, attrs) do
    with {:ok, updated} <- register |> Register.changeset(attrs) |> Repo.update() do
      Audit.log(scope, "register.updated", updated,
        entity_type: "register",
        label: updated.name,
        changes: %{before: register, after: updated}
      )

      {:ok, updated}
    end
  end

  @doc """
  Soft-deletes a till.

  Refused while a shift is open on it: the drawer still has money in it, and a
  deleted register is one nobody will ever count.
  """
  @spec delete_register(Scope.t(), Register.t()) ::
          {:ok, Register.t()} | {:error, :shift_open | Ecto.Changeset.t()}
  def delete_register(%Scope{} = scope, %Register{} = register) do
    case current_shift(scope, register.id) do
      nil ->
        with {:ok, deleted} <- register |> Register.soft_delete_changeset() |> Repo.update() do
          Audit.log(scope, "register.deleted", deleted,
            entity_type: "register",
            label: deleted.name
          )

          {:ok, deleted}
        end

      %Shift{} ->
        {:error, :shift_open}
    end
  end

  # ===========================================================================
  # Shifts
  # ===========================================================================

  @doc """
  Opens a shift on a till with a counted float.

  Fails with `:shift_already_open` if one is already running: the unique index
  is the arbiter, so two cashiers pressing "open" at the same moment produce
  one shift and one clear error rather than two drawers.
  """
  @spec open_shift(Scope.t(), Register.t(), map()) ::
          {:ok, Shift.t()} | {:error, :shift_already_open | term()}
  def open_shift(%Scope{} = scope, %Register{} = register, attrs) do
    Repo.transaction(fn ->
      with :ok <- ensure_register_active(register),
           {:ok, number} <- Sequences.next(scope, "shift"),
           {:ok, shift} <- insert_shift(scope, register, attrs, number) do
        Audit.log(scope, "shift.opened", shift,
          entity_type: "shift",
          label: shift.number,
          summary: "Opened with #{Decimal.to_string(shift.opening_float, :normal)} float"
        )

        shift
      else
        {:error, reason} -> Repo.rollback(normalize_open_error(reason))
      end
    end)
  end

  @doc "The shift currently running on a till, if any."
  @spec current_shift(Scope.t(), Ecto.UUID.t()) :: Shift.t() | nil
  def current_shift(%Scope{} = scope, register_id) do
    Shift
    |> Scoped.for_business(scope)
    |> where([shift], shift.register_id == ^register_id and shift.status == "open")
    |> Repo.one()
  end

  @doc "Fetches a shift."
  @spec fetch_shift(Scope.t(), Ecto.UUID.t()) :: {:ok, Shift.t()} | {:error, :not_found}
  def fetch_shift(%Scope{} = scope, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      Shift
      |> Scoped.for_business(scope)
      |> where([shift], shift.id == ^id)
      |> preload([:register, :opened_by, :closed_by])
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        shift -> {:ok, shift}
      end
    else
      {:error, :not_found}
    end
  end

  @doc "Lists shifts, most recently opened first."
  @spec list_shifts(Scope.t(), map()) :: [Shift.t()]
  def list_shifts(%Scope{} = scope, filters \\ %{}) do
    Shift
    |> Scoped.for_business(scope)
    |> Scoped.within_branches(scope)
    |> filter_branch(filters)
    |> filter_shift_status(filters)
    |> filter_shift_register(filters)
    |> order_by([shift], desc: shift.opened_at)
    |> Repo.all()
  end

  @doc """
  Closes a shift against a counted drawer.

  The variance is computed from the running totals, not sent by the client — a
  till that could report its own variance could report zero.

  A short drawer does not block the close. Refusing would leave the shift open
  and the next cashier unable to start; the number is recorded, and what
  happens next is a conversation, not a validation error.
  """
  @spec close_shift(Scope.t(), Shift.t(), map()) :: {:ok, Shift.t()} | {:error, term()}
  def close_shift(%Scope{} = scope, %Shift{} = shift, attrs) do
    if Shift.open?(shift) do
      Repo.transaction(fn ->
        # Re-read under lock: a sale committing between the read and the close
        # would otherwise be counted in neither shift.
        locked = lock_shift(shift.id)

        case locked
             |> Shift.close_changeset(attrs, Scope.user_id(scope))
             |> Repo.update() do
          {:ok, closed} ->
            log_close(scope, closed)
            closed

          {:error, reason} ->
            Repo.rollback(reason)
        end
      end)
    else
      {:error, :shift_not_open}
    end
  end

  @doc """
  Adds a sale's figures to its shift's running totals.

  Called by `Kaarobar.Sales.Checkout` inside the checkout transaction, so the
  shift and the sales it summarises can never disagree. Takes the shift row
  under lock, because two tills sharing a shift is unusual but a single till
  ringing two sales in the same millisecond is not.
  """
  @spec apply_sale(Sale.t(), [Payment.t()]) :: {:ok, Shift.t()} | {:error, term()}
  def apply_sale(%Sale{shift_id: nil}, _payments), do: {:ok, nil}

  def apply_sale(%Sale{} = sale, payments) do
    case lock_shift(sale.shift_id) do
      nil ->
        {:error, :shift_not_found}

      %Shift{} = shift ->
        shift
        |> Ecto.Changeset.change(sale_totals(shift, sale, payments))
        |> Repo.update()
    end
  end

  @doc """
  Adds a return's figures to its shift's totals.

  A refund is netted off the tender it went back through, so `tender_totals`
  stays the figure that reconciles against the outside world: the card
  terminal's own settlement is net of its refunds, and so is the cash in the
  drawer.

  Netting is why a cash refund does *not* also increase `cash_out`. Doing both
  would take the money out of the till twice, and every shift with a refund in
  it would close short by exactly the amount refunded — which is the kind of
  variance that teaches staff to stop looking at variances.
  """
  @spec apply_return(Ecto.UUID.t() | nil, Decimal.t(), [{String.t(), Decimal.t()}]) ::
          {:ok, Shift.t() | nil} | {:error, term()}
  def apply_return(nil, _total, _tenders), do: {:ok, nil}

  def apply_return(shift_id, total, tenders) do
    case lock_shift(shift_id) do
      nil ->
        {:error, :shift_not_found}

      %Shift{} = shift ->
        tender_totals =
          Enum.reduce(tenders, shift.tender_totals, fn {method, amount}, acc ->
            Shift.add_tender(%{shift | tender_totals: acc}, method, Decimal.negate(amount))
          end)

        shift
        |> Ecto.Changeset.change(%{
          refund_total: Money.add(shift.refund_total, total),
          tender_totals: tender_totals
        })
        |> Repo.update()
    end
  end

  # ===========================================================================
  # Cash movements
  # ===========================================================================

  @doc """
  Records money moving in or out of a drawer outside a sale.

  The caller supplies a magnitude and a kind; the sign follows from the kind,
  so a pay-out recorded with a positive number cannot silently inflate the
  till. The shift's `cash_in`/`cash_out` move with it in the same transaction.
  """
  @spec record_cash_movement(Scope.t(), Shift.t(), map()) ::
          {:ok, CashMovement.t()} | {:error, term()}
  def record_cash_movement(%Scope{} = scope, %Shift{} = shift, attrs) do
    if Shift.open?(shift) do
      Repo.transaction(fn ->
        movement_attrs =
          attrs
          |> stringify_keys()
          |> Map.merge(%{
            "organization_id" => Scope.organization_id(scope),
            "business_id" => Scope.business_id(scope),
            "shift_id" => shift.id,
            "actor_user_id" => Scope.user_id(scope),
            "actor_label" => scope.user && scope.user.name,
            "occurred_at" => DateTime.utc_now()
          })

        with {:ok, movement} <-
               %CashMovement{} |> CashMovement.changeset(movement_attrs) |> Repo.insert(),
             {:ok, _shift} <- apply_cash_movement(shift.id, movement) do
          Audit.log(scope, "cash.movement", movement,
            entity_type: "cash_movement",
            label: movement.reason,
            summary: "#{movement.kind} #{Decimal.to_string(movement.amount, :normal)}"
          )

          movement
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    else
      {:error, :shift_not_open}
    end
  end

  @doc "Cash movements on a shift, oldest first."
  @spec list_cash_movements(Scope.t(), Shift.t()) :: [CashMovement.t()]
  def list_cash_movements(%Scope{} = scope, %Shift{} = shift) do
    CashMovement
    |> Scoped.for_business(scope)
    |> where([movement], movement.shift_id == ^shift.id)
    |> order_by([movement], asc: movement.occurred_at, asc: movement.id)
    |> Repo.all()
  end

  # ===========================================================================
  # Reports
  # ===========================================================================

  @doc """
  The X report: where the shift stands right now, without closing it.

  Read from the running totals, so it costs one row.
  """
  @spec x_report(Scope.t(), Shift.t()) :: map()
  def x_report(%Scope{} = scope, %Shift{} = shift) do
    %{
      shift: shift,
      expected_cash: Shift.expected_cash(shift),
      net_sales: Shift.net_sales(shift),
      cash_movements: list_cash_movements(scope, shift)
    }
  end

  @doc """
  Recomputes a shift's totals from the sales themselves.

  The running totals should already agree. This is how anyone checks — and the
  only honest answer to "are you sure?" is a number derived a second way.
  """
  @spec reconcile_shift(Scope.t(), Shift.t()) :: map()
  def reconcile_shift(%Scope{} = scope, %Shift{} = shift) do
    sales =
      Sale
      |> Scoped.for_business(scope)
      |> where([sale], sale.shift_id == ^shift.id and sale.status != "voided")
      |> Repo.all()

    tenders =
      Payment
      |> Scoped.for_business(scope)
      |> where([payment], payment.shift_id == ^shift.id and payment.status == "captured")
      |> group_by([payment], payment.method)
      |> select([payment], {payment.method, sum(payment.amount)})
      |> Repo.all()
      |> Map.new(fn {method, amount} -> {method, Money.to_decimal(amount)} end)

    computed = %{
      sales_count: length(sales),
      gross_sales: sales |> Enum.map(& &1.total) |> Money.sum(),
      tax_total: sales |> Enum.map(& &1.tax_total) |> Money.sum(),
      discount_total: sales |> Enum.map(& &1.discount_total) |> Money.sum(),
      tenders: tenders
    }

    %{
      recorded: %{
        sales_count: shift.sales_count,
        gross_sales: shift.gross_sales,
        tax_total: shift.tax_total,
        discount_total: shift.discount_total,
        tenders: shift.tender_totals
      },
      computed: computed,
      agrees?: agrees?(shift, computed)
    }
  end

  # ===========================================================================
  # Internal
  # ===========================================================================

  defp agrees?(%Shift{} = shift, computed) do
    computed.sales_count == shift.sales_count and
      Decimal.compare(computed.gross_sales, shift.gross_sales) == :eq
  end

  defp insert_shift(%Scope{} = scope, %Register{} = register, attrs, number) do
    %Shift{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope),
      number: number,
      opened_by_id: Scope.user_id(scope)
    }
    |> Shift.open_changeset(
      attrs
      |> stringify_keys()
      |> Map.merge(%{"register_id" => register.id, "branch_id" => register.branch_id})
    )
    |> Repo.insert()
    |> case do
      # Reloaded so the caller sees the database's own values — the column
      # scales and the defaults it filled in — rather than what was cast.
      {:ok, shift} -> {:ok, Repo.reload!(shift)}
      {:error, changeset} -> {:error, changeset}
    end
  end

  defp ensure_register_active(%Register{} = register) do
    if Register.active?(register), do: :ok, else: {:error, :register_inactive}
  end

  # The unique index is what actually arbitrates two simultaneous opens; this
  # turns its constraint error into a name the client can act on.
  defp normalize_open_error(%Ecto.Changeset{errors: errors} = changeset) do
    if Keyword.has_key?(errors, :register_id), do: :shift_already_open, else: changeset
  end

  defp normalize_open_error(reason), do: reason

  defp lock_shift(shift_id) do
    Shift
    |> where([shift], shift.id == ^shift_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  # A tender's `amount` is what the sale was settled for, not what was handed
  # over: a customer paying 500 for a 200 sale contributes 200 to the drawer,
  # because the other 300 went straight back as change. Adding the change to
  # `cash_out` as well would take it out twice, and every shift would close
  # short by the change it gave out that day.
  defp sale_totals(%Shift{} = shift, %Sale{} = sale, payments) do
    tender_totals =
      Enum.reduce(payments, shift.tender_totals, fn payment, acc ->
        Shift.add_tender(%{shift | tender_totals: acc}, payment.method, payment.amount)
      end)

    %{
      sales_count: shift.sales_count + 1,
      gross_sales: Money.add(shift.gross_sales, sale.total),
      discount_total: Money.add(shift.discount_total, total_discount(sale)),
      tax_total: Money.add(shift.tax_total, sale.tax_total),
      tender_totals: tender_totals
    }
  end

  defp total_discount(%Sale{discount_total: line, order_discount: order}),
    do: Money.add(line, order)

  defp apply_cash_movement(shift_id, %CashMovement{} = movement) do
    case lock_shift(shift_id) do
      nil ->
        {:error, :shift_not_found}

      %Shift{} = shift ->
        magnitude = Decimal.abs(movement.amount)

        changes =
          if CashMovement.outward?(movement) do
            %{cash_out: Money.add(shift.cash_out, magnitude)}
          else
            %{cash_in: Money.add(shift.cash_in, magnitude)}
          end

        shift |> Ecto.Changeset.change(changes) |> Repo.update()
    end
  end

  defp log_close(%Scope{} = scope, %Shift{} = shift) do
    summary =
      if Shift.balanced?(shift) do
        "Closed level"
      else
        "Closed #{Decimal.to_string(shift.cash_variance, :normal)} out"
      end

    Audit.log(scope, "shift.closed", shift,
      entity_type: "shift",
      label: shift.number,
      summary: summary,
      metadata: %{
        "expected_cash" => Decimal.to_string(shift.expected_cash, :normal),
        "declared_cash" => Decimal.to_string(shift.declared_cash, :normal),
        "variance" => Decimal.to_string(shift.cash_variance, :normal)
      }
    )
  end

  defp put_default_branch(%Scope{} = scope, attrs) do
    attrs = stringify_keys(attrs)

    case Map.get(attrs, "branch_id") do
      nil -> Map.put(attrs, "branch_id", Scope.branch_id(scope))
      _branch_id -> attrs
    end
  end

  defp filter_branch(query, %{"branch_id" => branch_id}) when is_binary(branch_id),
    do: where(query, [record], record.branch_id == ^branch_id)

  defp filter_branch(query, _filters), do: query

  defp filter_shift_status(query, %{"status" => status}) when is_binary(status),
    do: where(query, [shift], shift.status == ^status)

  defp filter_shift_status(query, _filters), do: query

  defp filter_shift_register(query, %{"register_id" => id}) when is_binary(id),
    do: where(query, [shift], shift.register_id == ^id)

  defp filter_shift_register(query, _filters), do: query

  defp stringify_keys(attrs) when is_map(attrs) do
    Map.new(attrs, fn
      {key, value} when is_atom(key) -> {Atom.to_string(key), value}
      {key, value} -> {key, value}
    end)
  end
end
