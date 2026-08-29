defmodule Kaarobar.Purchasing.Supplier do
  @moduledoc """
  Who the shop buys from.

  `balance` is what is currently owed — a projection of
  `supplier_ledger_entries`, maintained in the same transaction as the entries
  that change it, exactly as `stock_items.on_hand` mirrors the stock ledger.

  `payment_terms_days` is what makes an ageing report mean anything: a bill is
  not overdue because it is old, it is overdue because it is older than the
  terms agreed with that particular supplier.
  """

  use Kaarobar.Schema

  alias Kaarobar.Money
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  schema "suppliers" do
    field :name, :string
    field :code, :string
    field :contact_name, :string
    field :phone, :string
    field :email, :string
    field :website, :string

    field :address_line1, :string
    field :address_line2, :string
    field :city, :string
    field :state, :string
    field :postal_code, :string
    field :country_code, :string

    field :tax_number, :string
    field :currency, :string

    field :payment_terms_days, :integer, default: 0
    field :credit_limit, :decimal
    field :balance, :decimal, default: Decimal.new(0)

    field :notes, :string
    field :is_active, :boolean, default: true
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business

    timestamps()
  end

  def changeset(supplier, attrs) do
    supplier
    |> cast(attrs, [
      :name,
      :code,
      :contact_name,
      :phone,
      :email,
      :website,
      :address_line1,
      :address_line2,
      :city,
      :state,
      :postal_code,
      :country_code,
      :tax_number,
      :currency,
      :payment_terms_days,
      :credit_limit,
      :notes,
      :is_active
    ])
    |> validate_required([:name])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 160)
    |> validate_length(:code, max: 40)
    |> validate_length(:country_code, is: 2)
    |> validate_format(:currency, ~r/^[A-Z]{3}$/,
      message: "must be a three-letter ISO 4217 code"
    )
    |> validate_number(:payment_terms_days, greater_than_or_equal_to: 0, less_than: 366)
    |> validate_number(:credit_limit, greater_than_or_equal_to: 0)
    |> validate_length(:notes, max: 2000)
    |> unique_constraint([:business_id, :code],
      name: :suppliers_business_id_code_index,
      message: "is already used by another supplier"
    )
  end

  @doc "Soft-deletes the supplier."
  def soft_delete_changeset(supplier), do: change(supplier, deleted_at: DateTime.utc_now())

  @doc "When a bill issued today would fall due."
  @spec due_date(t(), Date.t()) :: Date.t()
  def due_date(%__MODULE__{payment_terms_days: days}, issued_on),
    do: Date.add(issued_on, days || 0)

  @doc """
  True when a further bill would take the shop past its agreed credit limit.

  Advisory rather than blocking: a supplier refusing to deliver is their
  decision, not something this system should enforce mid-order.
  """
  @spec over_credit_limit?(t(), Decimal.t()) :: boolean()
  def over_credit_limit?(%__MODULE__{credit_limit: nil}, _additional), do: false

  def over_credit_limit?(%__MODULE__{balance: balance, credit_limit: limit}, additional) do
    Decimal.compare(Money.add(balance, additional), limit) == :gt
  end
end
