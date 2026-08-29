defmodule Kaarobar.Loyalty.Transaction do
  @moduledoc """
  One immutable movement of points.

  Append-only, enforced by a database trigger. `points` is signed — positive
  earns, negative spends — and `balance_after` snapshots the running total, so
  a disputed balance shows the row where it stopped adding up.

  `expires_on` is set on earnings only, and only when the programme expires
  points at all. The nightly sweep reads it; nothing else does.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Loyalty.Account
  alias Kaarobar.Tenancy.Business

  @kinds ~w(earn redeem expire adjustment reversal)

  schema "loyalty_transactions" do
    field :kind, :string
    field :points, :integer
    field :balance_after, :integer
    field :value_amount, :decimal

    field :reference_type, :string
    field :reference_id, Kaarobar.Ecto.UUIDv7
    field :note, :string

    field :expires_on, :date
    field :occurred_at, :utc_datetime_usec

    belongs_to :business, Business
    belongs_to :loyalty_account, Account
    belongs_to :actor_user, User

    timestamps(updated_at: false)
  end

  @doc "The kinds of movement the ledger records."
  def kinds, do: @kinds

  def changeset(transaction, attrs) do
    transaction
    |> cast(attrs, [
      :business_id,
      :loyalty_account_id,
      :kind,
      :points,
      :balance_after,
      :value_amount,
      :reference_type,
      :reference_id,
      :note,
      :expires_on,
      :occurred_at,
      :actor_user_id
    ])
    |> validate_required([
      :business_id,
      :loyalty_account_id,
      :kind,
      :points,
      :balance_after,
      :occurred_at
    ])
    |> validate_inclusion(:kind, @kinds)
    |> validate_non_zero_points()
    |> validate_direction()
    |> foreign_key_constraint(:loyalty_account_id)
  end

  @doc "True when this movement added points."
  @spec earning?(t()) :: boolean()
  def earning?(%__MODULE__{points: points}), do: points > 0

  defp validate_non_zero_points(changeset) do
    case get_field(changeset, :points) do
      nil -> changeset
      0 -> add_error(changeset, :points, "must not be zero")
      _points -> changeset
    end
  end

  # A redemption that adds points, or an expiry that does, is a sign error —
  # and one that silently mints value. Refuse it here rather than discover it
  # in a balance nobody can explain.
  defp validate_direction(changeset) do
    kind = get_field(changeset, :kind)
    points = get_field(changeset, :points)

    cond do
      is_nil(kind) or is_nil(points) ->
        changeset

      kind == "earn" and points < 0 ->
        add_error(changeset, :points, "must be positive to earn")

      kind in ["redeem", "expire"] and points > 0 ->
        add_error(changeset, :points, "must be negative to #{kind}")

      true ->
        changeset
    end
  end
end
