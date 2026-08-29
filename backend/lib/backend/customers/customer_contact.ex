defmodule Kaarobar.Customers.CustomerContact do
  @moduledoc """
  A person at a customer.

  Only meaningful once the customer is a business rather than a walk-in: the
  person who orders and the person who pays the bills are rarely the same, and
  chasing a debt through the buyer wastes a week.
  """

  use Kaarobar.Schema

  alias Kaarobar.Customers.Customer
  alias Kaarobar.Tenancy.Business

  schema "customer_contacts" do
    field :name, :string
    field :role, :string
    field :phone, :string
    field :email, :string
    field :notes, :string
    field :is_primary, :boolean, default: false

    belongs_to :business, Business
    belongs_to :customer, Customer

    timestamps()
  end

  def changeset(contact, attrs) do
    contact
    |> cast(attrs, [
      :business_id,
      :customer_id,
      :name,
      :role,
      :phone,
      :email,
      :notes,
      :is_primary
    ])
    |> validate_required([:business_id, :customer_id, :name])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 120)
    |> validate_length(:phone, max: 32)
    |> validate_format(:email, ~r/^[^\s]+@[^\s]+\.[^\s]+$/, message: "is not a valid address")
    |> validate_reachable()
    |> unique_constraint(:is_primary,
      name: :customer_contacts_single_primary_index,
      message: "another contact is already the primary one"
    )
    |> foreign_key_constraint(:customer_id)
  end

  # A contact with no way to contact them is an entry in an address book with
  # the address torn out.
  defp validate_reachable(changeset) do
    phone = get_field(changeset, :phone)
    email = get_field(changeset, :email)

    if blank?(phone) and blank?(email) do
      add_error(changeset, :phone, "or an email address is required")
    else
      changeset
    end
  end

  defp blank?(nil), do: true
  defp blank?(value), do: String.trim(value) == ""
end
