defmodule Kaarobar.Customers.Customer do
  @moduledoc """
  Who the shop sells to, and what they owe.

  The record itself stays small. Addresses, contacts, notes, follow-ups,
  loyalty, gift cards and store credit are all their own tables, joined to this
  one — what lives here is who they are and what they owe. A shop selling on
  account has to know that much, because a "pay later" tender that posts to no
  ledger is a debt nobody is tracking.

  `payment_terms_days` and the group are the exception: terms are asked for on
  every invoice, and `Kaarobar.Credit` falls back from the customer's own to
  their group's. Null here means "whatever the group says".

  `balance` is a projection of `customer_ledger_entries`, maintained in the
  same transaction as the entries that move it — the same shape as
  `stock_items.on_hand` and `suppliers.balance`.
  """

  use Kaarobar.Schema

  alias Kaarobar.Customers.CustomerGroup
  alias Kaarobar.Money
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  schema "customers" do
    field :name, :string
    field :code, :string
    field :phone, :string
    field :email, :string

    field :address_line1, :string
    field :address_line2, :string
    field :city, :string
    field :postal_code, :string
    field :country_code, :string

    field :tax_number, :string
    field :date_of_birth, :date
    field :notes, :string

    field :balance, :decimal, default: Decimal.new(0)
    field :credit_limit, :decimal
    field :credit_allowed, :boolean, default: false

    # Null means "whatever the group says". Set here it overrides the group,
    # because a shop always ends up with one customer on different terms.
    field :payment_terms_days, :integer
    field :is_tax_exempt, :boolean, default: false
    field :tags, {:array, :string}, default: []

    field :is_active, :boolean, default: true
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :customer_group, CustomerGroup

    timestamps()
  end

  def changeset(customer, attrs) do
    customer
    |> cast(attrs, [
      :name,
      :code,
      :phone,
      :email,
      :address_line1,
      :address_line2,
      :city,
      :postal_code,
      :country_code,
      :tax_number,
      :date_of_birth,
      :notes,
      :credit_limit,
      :credit_allowed,
      :customer_group_id,
      :payment_terms_days,
      :is_tax_exempt,
      :tags,
      :is_active
    ])
    |> validate_required([:name])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 160)
    |> normalize_phone()
    |> validate_length(:phone, max: 32)
    |> validate_format(:email, ~r/^[^\s]+@[^\s]+\.[^\s]+$/, message: "is not a valid address")
    |> validate_length(:country_code, is: 2)
    |> validate_number(:credit_limit, greater_than_or_equal_to: 0)
    # Matches `customers_terms_check`. Caught here as a field error rather than
    # left to the database, where it would surface as a 500 instead of telling
    # somebody which box to fix.
    |> validate_number(:payment_terms_days, greater_than_or_equal_to: 0)
    |> validate_credit_limit_implies_credit()
    |> foreign_key_constraint(:customer_group_id)
    |> unique_constraint(:phone,
      name: :customers_business_id_phone_index,
      message: "is already used by another customer"
    )
    |> unique_constraint(:code,
      name: :customers_business_id_code_index,
      message: "is already used by another customer"
    )
  end

  @doc "Soft-deletes the customer, keeping their history intact."
  def soft_delete_changeset(customer), do: change(customer, deleted_at: DateTime.utc_now())

  @doc """
  Moves the balance by a signed amount.

  Only the ledger calls this, and only alongside writing the entry that
  explains the move.
  """
  def balance_changeset(customer, new_balance),
    do: change(customer, balance: Money.round(new_balance))

  @doc """
  Whether this customer may take on `amount` more debt.

  Refusing a credit sale at the counter is awkward. Discovering six months of
  unpayable debt is worse, and the shopkeeper set the limit for a reason.
  """
  @spec credit_check(t(), Decimal.t()) ::
          :ok | {:error, :credit_not_allowed} | {:error, {:credit_limit_exceeded, Decimal.t()}}
  def credit_check(%__MODULE__{credit_allowed: false}, _amount), do: {:error, :credit_not_allowed}

  def credit_check(%__MODULE__{credit_limit: nil}, _amount), do: :ok

  def credit_check(%__MODULE__{} = customer, amount) do
    projected = Money.add(customer.balance, amount)

    if Decimal.compare(projected, customer.credit_limit) == :gt do
      {:error, {:credit_limit_exceeded, available_credit(customer)}}
    else
      :ok
    end
  end

  @doc "How much more this customer may put on account."
  @spec available_credit(t()) :: Decimal.t() | :unlimited
  def available_credit(%__MODULE__{credit_allowed: false}), do: Money.zero()
  def available_credit(%__MODULE__{credit_limit: nil}), do: :unlimited

  def available_credit(%__MODULE__{} = customer),
    do: customer.credit_limit |> Money.sub(customer.balance) |> Money.clamp_non_negative()

  @doc "True when the customer owes money."
  @spec owing?(t()) :: boolean()
  def owing?(%__MODULE__{balance: balance}), do: Money.positive?(balance)

  defp normalize_phone(changeset) do
    update_change(changeset, :phone, fn
      nil -> nil
      value -> if String.trim(value) == "", do: nil, else: String.trim(value)
    end)
  end

  # A limit set on a customer who cannot buy on credit is a setting that does
  # nothing, and reads as though it does something.
  defp validate_credit_limit_implies_credit(changeset) do
    limit = get_field(changeset, :credit_limit)
    allowed = get_field(changeset, :credit_allowed)

    if limit && !allowed do
      add_error(changeset, :credit_limit, "has no effect unless credit is allowed")
    else
      changeset
    end
  end
end
