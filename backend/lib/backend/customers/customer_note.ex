defmodule Kaarobar.Customers.CustomerNote do
  @moduledoc """
  Something worth remembering about a customer.

  `is_pinned` is the point of it. An unpinned note is history someone can go
  and read; a pinned one surfaces at the till, which is the only place a
  warning is any use — "cash only after last time", "allergic to nuts", "always
  disputes the delivery charge".
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Customers.Customer
  alias Kaarobar.Tenancy.Business

  schema "customer_notes" do
    field :body, :string
    field :is_pinned, :boolean, default: false
    field :author_label, :string

    belongs_to :business, Business
    belongs_to :customer, Customer
    belongs_to :author_user, User

    timestamps()
  end

  def changeset(note, attrs) do
    note
    |> cast(attrs, [
      :business_id,
      :customer_id,
      :body,
      :is_pinned,
      :author_user_id,
      :author_label
    ])
    |> validate_required([:business_id, :customer_id, :body])
    |> update_change(:body, &String.trim/1)
    |> validate_length(:body, min: 1, max: 2000)
    |> foreign_key_constraint(:customer_id)
  end
end
