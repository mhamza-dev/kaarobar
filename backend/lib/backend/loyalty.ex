defmodule Kaarobar.Loyalty do
  @moduledoc """
  Points: earning them, spending them, and letting them lapse.

  ## Points are a liability, not a feature

  Every point issued is a small debt the shop has taken on, payable in stock.
  That framing drives everything here: earning is floored rather than rounded,
  redemption is capped as a share of the bill, expiry is enforced rather than
  advertised, and a redemption checks the balance under a row lock instead of
  trusting what the till last read.

  `loyalty_accounts.points_balance` is a projection of
  `Kaarobar.Loyalty.Transaction`, maintained in the same transaction as the
  entries that move it — the same shape as every other ledger in the system.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Audit
  alias Kaarobar.Customers.Customer
  alias Kaarobar.Customers.CustomerGroup
  alias Kaarobar.Loyalty.Account
  alias Kaarobar.Loyalty.Program
  alias Kaarobar.Loyalty.Transaction
  alias Kaarobar.Money
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Scope

  # ===========================================================================
  # The programme
  # ===========================================================================

  @doc "The business's running programme, if it has one."
  @spec active_program(Scope.t()) :: Program.t() | nil
  def active_program(%Scope{} = scope) do
    Program
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> where([program], program.is_active)
    |> Repo.one()
  end

  @doc "Creates a programme. Only one may be running at a time."
  @spec create_program(Scope.t(), map()) :: {:ok, Program.t()} | {:error, Ecto.Changeset.t()}
  def create_program(%Scope{} = scope, attrs) do
    changeset =
      %Program{
        organization_id: Scope.organization_id(scope),
        business_id: Scope.business_id(scope)
      }
      |> Program.changeset(attrs)

    with {:ok, program} <- Repo.insert(changeset) do
      Audit.log(scope, "loyalty_program.created", program,
        entity_type: "loyalty_program",
        label: program.name
      )

      {:ok, program}
    end
  end

  @doc "Updates the programme's rules. Points already earned keep their value."
  @spec update_program(Scope.t(), Program.t(), map()) ::
          {:ok, Program.t()} | {:error, Ecto.Changeset.t()}
  def update_program(%Scope{} = scope, %Program{} = program, attrs) do
    with {:ok, updated} <- program |> Program.changeset(attrs) |> Repo.update() do
      Audit.log(scope, "loyalty_program.updated", updated,
        entity_type: "loyalty_program",
        label: updated.name,
        changes: %{before: program, after: updated}
      )

      {:ok, updated}
    end
  end

  # ===========================================================================
  # Accounts
  # ===========================================================================

  @doc """
  The customer's account on the running programme, creating it on first use.

  Enrolment is implicit. Asking a shopkeeper to enrol someone before their
  points count means the first purchase never earns, and the customer's first
  experience of the scheme is being told they missed out.
  """
  @spec ensure_account(Scope.t(), Customer.t()) ::
          {:ok, Account.t()} | {:error, :no_program | Ecto.Changeset.t()}
  def ensure_account(%Scope{} = scope, %Customer{} = customer) do
    case active_program(scope) do
      nil ->
        {:error, :no_program}

      %Program{} = program ->
        case fetch_account(scope, program, customer) do
          nil -> create_account(scope, program, customer)
          account -> {:ok, account}
        end
    end
  end

  @doc "The customer's account, or nil when they have never earned."
  @spec account_for(Scope.t(), Customer.t()) :: Account.t() | nil
  def account_for(%Scope{} = scope, %Customer{} = customer) do
    case active_program(scope) do
      nil -> nil
      program -> fetch_account(scope, program, customer)
    end
  end

  @doc "A customer's points history, most recent first."
  @spec list_transactions(Scope.t(), Account.t()) :: [Transaction.t()]
  def list_transactions(%Scope{} = scope, %Account{} = account) do
    Transaction
    |> Scoped.for_business(scope)
    |> where([entry], entry.loyalty_account_id == ^account.id)
    |> order_by([entry], desc: entry.occurred_at, desc: entry.id)
    |> Repo.all()
  end

  # ===========================================================================
  # Earning and spending
  # ===========================================================================

  @doc """
  Awards points for a sale.

  The amount that earns is decided by the programme: tax-exclusive by default,
  and discounted lines excluded when the shop says so — a scheme that pays
  points on a half-price promotion pays twice for the same sale.

  Call inside the checkout transaction. A sale that commits without its points
  is a customer who has to be believed later.
  """
  @spec earn(Scope.t(), Customer.t(), map()) ::
          {:ok, Transaction.t()} | {:ok, :no_program} | {:error, term()}
  def earn(%Scope{} = scope, %Customer{} = customer, sale_attrs) do
    case active_program(scope) do
      nil ->
        {:ok, :no_program}

      %Program{} = program ->
        earnable = earnable_amount(program, sale_attrs)
        points = Program.points_for(program, earnable, multiplier(customer))

        if points > 0 do
          with {:ok, account} <- ensure_account(scope, customer) do
            post(scope, account, %{
              kind: "earn",
              points: points,
              expires_on: Program.expiry_for(program, Date.utc_today()),
              reference_type: "sale",
              reference_id: Map.get(sale_attrs, :sale_id),
              note: Map.get(sale_attrs, :note)
            })
          end
        else
          {:ok, :no_program}
        end
    end
  end

  @doc """
  Spends points against a bill, returning what they are worth in money.

  Refuses more than the programme allows, more than the customer has, or more
  than the bill is worth. The balance is read under a row lock: two tills
  redeeming the same account at once would otherwise both see enough points.
  """
  @spec redeem(Scope.t(), Customer.t(), integer(), map()) ::
          {:ok, %{transaction: Transaction.t(), value: Decimal.t()}}
          | {:error, :no_program | :no_account | :insufficient_points | term()}
  def redeem(%Scope{} = scope, %Customer{} = customer, points, attrs \\ %{}) do
    with {:ok, program} <- require_program(scope),
         {:ok, account} <- require_account(scope, customer),
         {:ok, locked} <- lock_account(account.id),
         :ok <- validate_redemption(program, locked, points, Map.get(attrs, :bill_total)),
         value = Program.value_of(program, points),
         {:ok, transaction} <-
           post(scope, locked, %{
             kind: "redeem",
             points: -points,
             value_amount: value,
             reference_type: Map.get(attrs, :reference_type, "sale"),
             reference_id: Map.get(attrs, :reference_id),
             note: Map.get(attrs, :note)
           }) do
      {:ok, %{transaction: transaction, value: value}}
    end
  end

  defp require_program(%Scope{} = scope) do
    case active_program(scope) do
      nil -> {:error, :no_program}
      program -> {:ok, program}
    end
  end

  defp require_account(%Scope{} = scope, %Customer{} = customer) do
    case account_for(scope, customer) do
      nil -> {:error, :no_account}
      account -> {:ok, account}
    end
  end

  @doc """
  Gives back points spent on a sale that was returned.

  A `reversal` rather than an `earn`, so a report can tell points the shop gave
  away from points it merely un-took.
  """
  @spec reverse(Scope.t(), Customer.t(), integer(), map()) ::
          {:ok, Transaction.t()} | {:error, term()}
  def reverse(%Scope{} = scope, %Customer{} = customer, points, attrs \\ %{}) do
    with {:ok, account} <- ensure_account(scope, customer) do
      post(scope, account, Map.merge(attrs, %{kind: "reversal", points: points}))
    end
  end

  @doc """
  Adjusts a balance by hand, with a reason.

  For the cases a scheme cannot anticipate — a goodwill gesture, a correction
  after a mis-scan. The reason is required because an unexplained adjustment to
  a customer's points is indistinguishable from staff awarding themselves some.
  """
  @spec adjust(Scope.t(), Customer.t(), integer(), String.t()) ::
          {:ok, Transaction.t()} | {:error, term()}
  def adjust(%Scope{} = scope, %Customer{} = customer, points, reason) do
    cond do
      points == 0 ->
        {:error, :amount_must_not_be_zero}

      is_nil(reason) or String.trim(reason) == "" ->
        {:error, :reason_required}

      true ->
        with {:ok, account} <- ensure_account(scope, customer) do
          post(scope, account, %{kind: "adjustment", points: points, note: String.trim(reason)})
        end
    end
  end

  @doc """
  Expires points that have passed their date.

  Run nightly. Expiry is applied per account as one entry rather than one per
  lapsed earning: a customer looking at their history wants "1,200 points
  expired on 1 March", not forty rows.
  """
  @spec expire_due(Scope.t(), Date.t()) :: {:ok, non_neg_integer()}
  def expire_due(%Scope{} = scope, as_of \\ Date.utc_today()) do
    lapsed =
      Transaction
      |> Scoped.for_business(scope)
      |> where([entry], entry.kind == "earn")
      |> where([entry], not is_nil(entry.expires_on) and entry.expires_on <= ^as_of)
      |> group_by([entry], entry.loyalty_account_id)
      |> select([entry], %{account_id: entry.loyalty_account_id, points: sum(entry.points)})
      |> Repo.all()

    expired =
      Enum.reduce(lapsed, 0, fn %{account_id: account_id}, count ->
        case expire_account(scope, account_id, as_of) do
          {:ok, 0} -> count
          {:ok, _points} -> count + 1
          {:error, _reason} -> count
        end
      end)

    {:ok, expired}
  end

  # ===========================================================================
  # Internal
  # ===========================================================================

  @doc """
  Writes a transaction and moves the balance with it.

  Public because checkout and returns both post through it, and private
  helpers cannot be called across contexts. Assumes the account row is already
  locked when the caller cares about concurrency — `redeem/4` does, `earn/3`
  does not need to, because adding points can never overdraw.
  """
  @spec post(Scope.t(), Account.t(), map()) :: {:ok, Transaction.t()} | {:error, term()}
  def post(%Scope{} = scope, %Account{} = account, attrs) do
    points = Map.fetch!(attrs, :points)
    balance_after = account.points_balance + points

    entry_attrs =
      Map.merge(attrs, %{
        business_id: Scope.business_id(scope),
        loyalty_account_id: account.id,
        balance_after: balance_after,
        occurred_at: Map.get(attrs, :occurred_at) || DateTime.utc_now(),
        actor_user_id: Scope.user_id(scope)
      })

    with {:ok, transaction} <-
           %Transaction{} |> Transaction.changeset(entry_attrs) |> Repo.insert(),
         {:ok, _account} <- account |> Account.balance_changeset(points) |> Repo.update() do
      {:ok, transaction}
    end
  end

  defp create_account(%Scope{} = scope, %Program{} = program, %Customer{} = customer) do
    %Account{}
    |> Account.changeset(%{
      business_id: Scope.business_id(scope),
      loyalty_program_id: program.id,
      customer_id: customer.id,
      enrolled_at: DateTime.utc_now()
    })
    |> Repo.insert()
  end

  defp fetch_account(%Scope{} = scope, %Program{} = program, %Customer{} = customer) do
    Account
    |> Scoped.for_business(scope)
    |> where([account], account.loyalty_program_id == ^program.id)
    |> where([account], account.customer_id == ^customer.id)
    |> Repo.one()
  end

  defp lock_account(account_id) do
    Account
    |> where([account], account.id == ^account_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
    |> case do
      nil -> {:error, :no_account}
      account -> {:ok, account}
    end
  end

  defp validate_redemption(%Program{} = program, %Account{} = account, points, bill_total) do
    cond do
      points <= 0 ->
        {:error, :points_must_be_positive}

      not Program.can_redeem?(program, account.points_balance) ->
        {:error, :insufficient_points}

      points > account.points_balance ->
        {:error, :insufficient_points}

      is_nil(bill_total) ->
        :ok

      points > Program.max_redeemable(program, account.points_balance, bill_total) ->
        {:error, :exceeds_redemption_cap}

      true ->
        :ok
    end
  end

  # What the sale earns on. Tax is excluded unless the programme says
  # otherwise, and a discounted line can be excluded entirely — paying points
  # on a promotion means discounting the same sale twice.
  defp earnable_amount(%Program{} = program, attrs) do
    base =
      if program.earn_on_tax do
        Map.get(attrs, :total) || Map.get(attrs, :subtotal) || Money.zero()
      else
        Map.get(attrs, :subtotal) || Money.zero()
      end

    if program.earn_on_discounted do
      base
    else
      base
      |> Money.sub(Map.get(attrs, :discount_total) || Money.zero())
      |> Money.clamp_non_negative()
    end
  end

  defp multiplier(%Customer{customer_group: %CustomerGroup{} = group}),
    do: CustomerGroup.loyalty_multiplier(group)

  defp multiplier(%Customer{}), do: Decimal.new(1)

  defp expire_account(%Scope{} = scope, account_id, as_of) do
    with {:ok, account} <- lock_account(account_id) do
      # Only what is actually still there can lapse: a customer who has already
      # spent their old points must not go negative because those points were
      # the ones that aged out.
      lapsed =
        Transaction
        |> Scoped.for_business(scope)
        |> where([entry], entry.loyalty_account_id == ^account_id)
        |> where([entry], entry.kind == "earn")
        |> where([entry], not is_nil(entry.expires_on) and entry.expires_on <= ^as_of)
        |> select([entry], coalesce(sum(entry.points), 0))
        |> Repo.one()

      already_expired =
        Transaction
        |> Scoped.for_business(scope)
        |> where([entry], entry.loyalty_account_id == ^account_id)
        |> where([entry], entry.kind == "expire")
        |> select([entry], coalesce(sum(entry.points), 0))
        |> Repo.one()

      to_expire = min(lapsed + already_expired, account.points_balance)

      if to_expire > 0 do
        with {:ok, _transaction} <-
               post(scope, account, %{
                 kind: "expire",
                 points: -to_expire,
                 note: "Points expired on #{Date.to_iso8601(as_of)}"
               }) do
          {:ok, to_expire}
        end
      else
        {:ok, 0}
      end
    end
  end
end
