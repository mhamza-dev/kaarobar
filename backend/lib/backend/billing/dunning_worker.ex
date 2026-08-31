defmodule Kaarobar.Billing.DunningWorker do
  @moduledoc """
  Chases unpaid invoices, and eventually stops.

  Three jobs in one because they are one decision made in order: try to collect
  what is due, end the subscriptions whose grace has now run out, and close the
  ones that were cancelled and have reached the end of what they paid for.

  Running them separately would let an organization be cut off by the second
  step in the minute before the first one collected its money.
  """

  use Oban.Worker,
    queue: :maintenance,
    max_attempts: 3,
    unique: [period: 300, states: [:available, :scheduled, :executing]]

  alias Kaarobar.Billing

  require Logger

  @batch 100

  @impl Oban.Worker
  def perform(%Oban.Job{args: args}) do
    limit = Map.get(args, "limit", @batch)

    result = Billing.process_dunning(limit)
    expired = Billing.expire_lapsed()
    closed = Billing.close_cancelled()

    if result.collected > 0 or result.failed > 0 or expired > 0 or closed > 0 do
      Logger.info(
        "billing dunning: #{result.collected} collected, #{result.failed} failed, " <>
          "#{expired} expired, #{closed} closed"
      )
    end

    :ok
  end

  @doc "Runs a collection pass now."
  @spec enqueue(keyword()) :: {:ok, Oban.Job.t()} | {:error, term()}
  def enqueue(opts \\ []) do
    %{limit: Keyword.get(opts, :limit, @batch)}
    |> new()
    |> Oban.insert()
  end
end
