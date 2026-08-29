defmodule Kaarobar.Registers.CashMovement do
  @moduledoc """
  Money into or out of a drawer for a reason that is not a sale.

  Change brought in at the start of a rush, a supplier paid in cash, a drop to
  the safe when the drawer gets heavy. Each has to be recorded or the count
  will never balance — and staff who see an unexplained variance every evening
  quickly learn to ignore all of them.

  `amount` is signed: positive into the drawer, negative out. Callers pass the
  magnitude and the kind; the sign is applied here, so a pay-out recorded with
  a positive number cannot silently inflate the till.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Registers.Shift
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @kinds ~w(pay_in pay_out drop float_adjustment)
  # Kinds that always take money out of the drawer.
  @outward ~w(pay_out drop)

  schema "cash_movements" do
    field :kind, :string
    field :amount, :decimal
    field :reason, :string
    field :reference, :string
    field :note, :string

    field :actor_label, :string
    field :occurred_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :shift, Shift
    belongs_to :actor_user, User

    timestamps(updated_at: false)
  end

  @doc "The reasons money moves in or out outside a sale."
  def kinds, do: @kinds

  @doc """
  Builds a movement from a magnitude and a kind.

  The caller supplies how much; the sign follows from the kind. A
  `float_adjustment` is the one kind that may go either way, so its sign is
  taken as given.
  """
  def changeset(movement, attrs) do
    movement
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :shift_id,
      :kind,
      :amount,
      :reason,
      :reference,
      :note,
      :actor_user_id,
      :actor_label,
      :occurred_at
    ])
    |> validate_required([
      :organization_id,
      :business_id,
      :shift_id,
      :kind,
      :amount,
      :reason,
      :occurred_at
    ])
    |> validate_inclusion(:kind, @kinds)
    |> validate_length(:reason, min: 1, max: 160)
    |> apply_sign()
    |> validate_non_zero()
    |> foreign_key_constraint(:shift_id)
  end

  @doc "True when this movement takes money out of the drawer."
  @spec outward?(t()) :: boolean()
  def outward?(%__MODULE__{amount: amount}), do: Decimal.compare(amount, 0) == :lt

  defp apply_sign(changeset) do
    kind = get_field(changeset, :kind)
    amount = get_field(changeset, :amount)

    cond do
      is_nil(kind) or is_nil(amount) -> changeset
      kind in @outward -> put_change(changeset, :amount, Decimal.negate(Decimal.abs(amount)))
      kind == "pay_in" -> put_change(changeset, :amount, Decimal.abs(amount))
      true -> changeset
    end
  end

  defp validate_non_zero(changeset) do
    case get_field(changeset, :amount) do
      nil ->
        changeset

      amount ->
        if Decimal.compare(amount, 0) == :eq do
          add_error(changeset, :amount, "must not be zero")
        else
          changeset
        end
    end
  end
end
