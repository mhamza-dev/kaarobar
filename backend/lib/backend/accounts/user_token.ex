defmodule Kaarobar.Accounts.UserToken do
  @moduledoc """
  Bearer tokens and the single-use tokens behind email flows.

  What the client holds is 32 bytes of `:crypto.strong_rand_bytes/1`, encoded
  URL-safe. What the database holds is its SHA-256 hash. Nothing reversible is
  stored, so a database dump yields no usable sessions — the same reasoning as
  hashing passwords, applied to the credential that is actually transmitted on
  every single request.

  Hashing also makes verification an index lookup: the presented token is
  hashed and compared by the database, so there is no scan and no timing
  side-channel from comparing secrets in Elixir.

  ## Why database-backed rather than JWT

  A shop loses a tablet. With a signed JWT, the only honest answer is "it works
  until it expires". Here it is one `UPDATE`. Revocation, per-device listing,
  "sign out everywhere" and last-used timestamps all fall out of storing the
  session, and the cost is one indexed lookup per request.

  ## Lifetimes

  | Context | Valid for | Why |
  |---|---|---|
  | `session` | 60 days | Browser sessions on `web/main`. |
  | `api` | 365 days | A till tablet that is signed in once and never again. |
  | `confirm` | 7 days | Long enough to find the email. |
  | `reset_password` | 60 minutes | Short: it bypasses the password. |
  | `invite` | 14 days | Long enough for a new hire's first shift. |
  """

  use Kaarobar.Schema

  import Ecto.Query, warn: false

  alias Kaarobar.Accounts.User
  alias Kaarobar.Accounts.UserToken

  @hash_algorithm :sha256
  @rand_size 32

  @session_validity_in_days 60
  @api_validity_in_days 365
  @confirm_validity_in_days 7
  @reset_password_validity_in_minutes 60
  @invite_validity_in_days 14

  @contexts ~w(session api reset_password confirm invite)

  schema "user_tokens" do
    field :token, :binary, redact: true
    field :context, :string
    field :sent_to, :string

    field :device_name, :string
    field :user_agent, :string
    field :ip_address, :string

    field :last_used_at, :utc_datetime_usec
    field :expires_at, :utc_datetime_usec
    field :revoked_at, :utc_datetime_usec

    belongs_to :user, User

    timestamps(updated_at: false)
  end

  @doc "The token contexts this schema understands."
  def contexts, do: @contexts

  @doc """
  Builds a bearer token for a signed-in device.

  Returns `{plaintext_token, struct}`. The plaintext is returned exactly once,
  at issue; it is never recoverable afterwards.

  ## Options

    * `:context` — `"api"` (default) or `"session"`
    * `:device_name`, `:user_agent`, `:ip_address` — shown on the user's
      device list so they can recognise which one to revoke
  """
  def build_bearer_token(%User{} = user, opts \\ []) do
    context = Keyword.get(opts, :context, "api")
    raw = :crypto.strong_rand_bytes(@rand_size)

    token = %UserToken{
      token: hash(raw),
      context: context,
      user_id: user.id,
      device_name: Keyword.get(opts, :device_name),
      user_agent: truncate(Keyword.get(opts, :user_agent), 500),
      ip_address: Keyword.get(opts, :ip_address),
      expires_at: expires_at(context)
    }

    {encode(raw), token}
  end

  @doc """
  Query returning the user for a valid bearer token.

  Rejects tokens that are revoked, expired, or belong to an account that is no
  longer active — a suspended employee's tablet stops working on the next
  request, not at the next sign-in.
  """
  def verify_bearer_token_query(encoded_token) do
    case decode(encoded_token) do
      {:ok, raw} ->
        hashed = hash(raw)
        now = DateTime.utc_now()

        query =
          from token in by_token_and_context_query(hashed, ["api", "session"]),
            join: user in assoc(token, :user),
            where: is_nil(token.revoked_at),
            where: is_nil(user.deleted_at) and user.status == "active",
            where: is_nil(token.expires_at) or token.expires_at > ^now,
            select: {user, token}

        {:ok, query}

      :error ->
        :error
    end
  end

  @doc """
  Builds a single-use token for an email flow.

  `sent_to` records the address the email went to. If the user changes their
  address before following the link, the token stops working — otherwise a
  reset sent to an address the user no longer controls would still take over
  the account.
  """
  def build_email_token(%User{} = user, context) when context in @contexts do
    raw = :crypto.strong_rand_bytes(@rand_size)

    token = %UserToken{
      token: hash(raw),
      context: context,
      sent_to: user.email,
      user_id: user.id,
      expires_at: expires_at(context)
    }

    {encode(raw), token}
  end

  @doc """
  Query returning the user for a valid email token, provided their address
  still matches the one it was sent to.
  """
  def verify_email_token_query(encoded_token, context) do
    case decode(encoded_token) do
      {:ok, raw} ->
        hashed = hash(raw)
        now = DateTime.utc_now()

        query =
          from token in by_token_and_context_query(hashed, [context]),
            join: user in assoc(token, :user),
            where: is_nil(token.revoked_at),
            where: is_nil(user.deleted_at),
            where: is_nil(token.expires_at) or token.expires_at > ^now,
            where: token.sent_to == user.email,
            select: user

        {:ok, query}

      :error ->
        :error
    end
  end

  @doc "Query for every token a user holds in the given contexts."
  def by_user_and_contexts_query(%User{} = user, :all) do
    from token in UserToken, where: token.user_id == ^user.id
  end

  def by_user_and_contexts_query(%User{} = user, contexts) when is_list(contexts) do
    from token in UserToken,
      where: token.user_id == ^user.id and token.context in ^contexts
  end

  @doc "Query for a single token by id, scoped to its owner."
  def by_user_and_id_query(%User{} = user, id) do
    from token in UserToken, where: token.user_id == ^user.id and token.id == ^id
  end

  @doc "Query for tokens whose usefulness has ended, for the scheduled sweep."
  def expired_query(now \\ DateTime.utc_now()) do
    from token in UserToken,
      where: not is_nil(token.expires_at) and token.expires_at < ^now,
      or_where: not is_nil(token.revoked_at) and token.revoked_at < ^now
  end

  # --- Internal ---------------------------------------------------------------

  defp by_token_and_context_query(hashed_token, contexts) do
    from token in UserToken,
      where: token.token == ^hashed_token and token.context in ^contexts
  end

  defp hash(raw), do: :crypto.hash(@hash_algorithm, raw)

  defp encode(raw), do: Base.url_encode64(raw, padding: false)

  defp decode(encoded) when is_binary(encoded), do: Base.url_decode64(encoded, padding: false)
  defp decode(_encoded), do: :error

  defp expires_at("session"), do: shift_days(@session_validity_in_days)
  defp expires_at("api"), do: shift_days(@api_validity_in_days)
  defp expires_at("confirm"), do: shift_days(@confirm_validity_in_days)
  defp expires_at("invite"), do: shift_days(@invite_validity_in_days)

  defp expires_at("reset_password") do
    DateTime.add(DateTime.utc_now(), @reset_password_validity_in_minutes * 60, :second)
  end

  defp shift_days(days), do: DateTime.add(DateTime.utc_now(), days * 24 * 60 * 60, :second)

  defp truncate(nil, _max), do: nil
  defp truncate(value, max) when is_binary(value), do: String.slice(value, 0, max)
end
