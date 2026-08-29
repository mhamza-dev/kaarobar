defmodule Kaarobar.Sales.PaymentRefund do
  @moduledoc """
  Money going back out through the tender it came in on.

  A card refund goes to the card, cash to the drawer. That is what the customer
  expects, and it is what reconciles against the card terminal's own
  settlement — refunding a card payment in cash makes both totals wrong and
  hands out money that is hard to trace.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Registers.Shift
  alias Kaarobar.Sales.Payment
  alias Kaarobar.Tenancy.Business

  schema "payment_refunds" do
    field :sale_return_id, Kaarobar.Ecto.UUIDv7
    field :method, :string
    field :amount, :decimal
    field :reference, :string
    field :occurred_at, :utc_datetime_usec

    belongs_to :business, Business
    belongs_to :payment, Payment
    belongs_to :shift, Shift
    belongs_to :actor_user, User

    timestamps(updated_at: false)
  end

  def changeset(refund, attrs) do
    refund
    |> cast(attrs, [
      :business_id,
      :payment_id,
      :sale_return_id,
      :shift_id,
      :method,
      :amount,
      :reference,
      :actor_user_id,
      :occurred_at
    ])
    |> validate_required([:business_id, :payment_id, :method, :amount, :occurred_at])
    |> validate_inclusion(:method, Payment.methods())
    |> validate_number(:amount, greater_than: 0)
    |> foreign_key_constraint(:payment_id)
  end
end
