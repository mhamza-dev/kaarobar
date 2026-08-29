defmodule Kaarobar.Tenancy.Invitation do
  @moduledoc """
  A pending offer of staff access.

  Invitations exist separately from memberships because the invitee usually has
  no account yet — a shop owner adding a cashier knows their phone number, not
  whether they have ever used Kaarobar. The membership is created on
  acceptance, so an unaccepted invitation grants nothing, and an expired one
  grants nothing ever again.

  As with `Kaarobar.Accounts.UserToken`, only the hash of the emailed token is
  stored.
  """

  use Kaarobar.Schema

  import Ecto.Query, warn: false

  alias Kaarobar.AccessControl.Role
  alias Kaarobar.Accounts.User
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Invitation
  alias Kaarobar.Tenancy.Organization

  @hash_algorithm :sha256
  @rand_size 32
  @validity_in_days 14

  @statuses ~w(pending accepted revoked expired)

  schema "invitations" do
    field :email, :string
    field :name, :string
    field :phone, :string

    field :branch_ids, {:array, :binary_id}, default: []

    field :token, :binary, redact: true
    field :status, :string, default: "pending"
    field :message, :string

    field :expires_at, :utc_datetime_usec
    field :accepted_at, :utc_datetime_usec
    field :revoked_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :role, Role
    belongs_to :invited_by, User
    belongs_to :accepted_user, User

    timestamps()
  end

  @doc "The statuses an invitation may hold."
  def statuses, do: @statuses

  @doc "How long an invitation stays usable."
  def validity_in_days, do: @validity_in_days

  @doc """
  Builds an invitation and returns `{plaintext_token, changeset}`.

  The plaintext goes into the email and is never stored.
  """
  def build(attrs) do
    raw = :crypto.strong_rand_bytes(@rand_size)

    changeset =
      %Invitation{}
      |> cast(attrs, [
        :organization_id,
        :business_id,
        :email,
        :name,
        :phone,
        :role_id,
        :branch_ids,
        :invited_by_id,
        :message
      ])
      |> put_change(:token, hash(raw))
      |> put_change(:status, "pending")
      |> put_change(:expires_at, default_expiry())
      |> validate_common()

    {encode(raw), changeset}
  end

  @doc "Marks the invitation accepted by the given user."
  def accept_changeset(%Invitation{} = invitation, %User{} = user) do
    change(invitation,
      status: "accepted",
      accepted_at: DateTime.utc_now(),
      accepted_user_id: user.id
    )
  end

  @doc "Withdraws an invitation that has not been accepted."
  def revoke_changeset(%Invitation{} = invitation) do
    change(invitation, status: "revoked", revoked_at: DateTime.utc_now())
  end

  @doc "Query for a pending, unexpired invitation matching a plaintext token."
  def verify_token_query(encoded_token) do
    case decode(encoded_token) do
      {:ok, raw} ->
        now = DateTime.utc_now()

        query =
          from invitation in Invitation,
            where: invitation.token == ^hash(raw),
            where: invitation.status == "pending",
            where: invitation.expires_at > ^now

        {:ok, query}

      :error ->
        :error
    end
  end

  @doc "True when the invitation can still be accepted."
  def acceptable?(%Invitation{status: "pending", expires_at: expires_at}) do
    DateTime.compare(expires_at, DateTime.utc_now()) == :gt
  end

  def acceptable?(%Invitation{}), do: false

  defp validate_common(changeset) do
    changeset
    |> validate_required([:organization_id, :email, :role_id, :expires_at])
    |> update_change(:email, &normalize_email/1)
    |> validate_format(:email, ~r/^[^@,;\s]+@[^@,;\s]+\.[^@,;\s]+$/,
      message: "must be a valid email address"
    )
    |> validate_length(:email, max: 160)
    |> validate_length(:name, max: 120)
    |> validate_length(:message, max: 1000)
    |> validate_inclusion(:status, @statuses)
    |> foreign_key_constraint(:organization_id)
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:role_id)
    |> unique_constraint([:organization_id, :email],
      name: :invitations_pending_unique_index,
      message: "already has a pending invitation"
    )
  end

  defp normalize_email(email), do: email |> String.trim() |> String.downcase()

  defp default_expiry do
    DateTime.add(DateTime.utc_now(), @validity_in_days * 24 * 60 * 60, :second)
  end

  defp hash(raw), do: :crypto.hash(@hash_algorithm, raw)
  defp encode(raw), do: Base.url_encode64(raw, padding: false)

  defp decode(encoded) when is_binary(encoded), do: Base.url_decode64(encoded, padding: false)
  defp decode(_encoded), do: :error
end
