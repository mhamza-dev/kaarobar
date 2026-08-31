defmodule Kaarobar.Fiscal.RetryWorker do
  @moduledoc """
  Keeps trying to report the invoices the authority has not taken yet.

  Runs on a schedule across every tenant rather than one job per submission.
  A job per submission would mean the retry backoff lived in two places — Oban's
  and the submission's — and the two would disagree the first time somebody
  retried one by hand from the admin screen.

  ## Why it is capped and unique

  `@batch` bounds how much one run does, so a tenant whose authority has been
  down all day cannot starve everyone else's invoices behind theirs. The
  `unique` option stops a slow run and the next tick overlapping and sending
  the same invoice twice — which, for a tax authority, means declaring the same
  turnover twice and being billed for it.
  """

  use Oban.Worker,
    queue: :fiscal,
    max_attempts: 3,
    unique: [period: 60, states: [:available, :scheduled, :executing]]

  alias Kaarobar.Fiscal

  require Logger

  @batch 100

  @impl Oban.Worker
  def perform(%Oban.Job{args: args}) do
    limit = Map.get(args, "limit", @batch)
    result = Fiscal.process_due(limit)

    if result.ok > 0 or result.error > 0 do
      Logger.info("fiscal retry: #{result.ok} accepted or queued, #{result.error} still failing")
    end

    :ok
  end

  @doc "Queues a run now, for the admin screen's \"retry everything\" button."
  @spec enqueue(keyword()) :: {:ok, Oban.Job.t()} | {:error, term()}
  def enqueue(opts \\ []) do
    %{limit: Keyword.get(opts, :limit, @batch)}
    |> new()
    |> Oban.insert()
  end
end
