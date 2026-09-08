defmodule Kaarobar.Accounts.TokenCleanupWorker do
  @moduledoc """
  Sweeps expired and revoked bearer tokens, and expired idempotency keys.

  `user_tokens` and `idempotency_keys` both carry their own expiry already —
  `Kaarobar.Accounts.prune_expired_tokens/0` and
  `Kaarobar.Idempotency.prune_expired/0` were written for exactly this sweep
  but, until this worker, nothing ever called them on a schedule. Neither
  table is RLS-protected (see
  `priv/repo/migrations/20260909000000_enable_row_level_security.exs`):
  `user_tokens` belongs to the global identity, not a tenant, and
  `idempotency_keys` is swept across every organization at once by design, the
  same as this worker is.
  """

  use Oban.Worker,
    queue: :maintenance,
    max_attempts: 3,
    unique: [period: 3600, states: [:available, :scheduled, :executing]]

  alias Kaarobar.Accounts
  alias Kaarobar.Idempotency

  require Logger

  @impl Oban.Worker
  def perform(_job) do
    {tokens, _} = Accounts.prune_expired_tokens()
    {keys, _} = Idempotency.prune_expired()

    if tokens > 0 or keys > 0 do
      Logger.info("cleanup: pruned #{tokens} expired token(s), #{keys} idempotency key(s)")
    end

    :ok
  end
end
