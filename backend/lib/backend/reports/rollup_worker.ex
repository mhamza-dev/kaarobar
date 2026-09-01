defmodule Kaarobar.Reports.RollupWorker do
  @moduledoc """
  Folds each business's finished days into the rollup tables overnight.

  Runs per business rather than in one pass, because "the day is over" is a
  different instant for a shop in Karachi and one in Lisbon. A single global
  job would have to pick one midnight and be wrong for everybody else.

  ## Why it looks back rather than only at yesterday

  A sale voided on Friday against Tuesday's takings changes Tuesday. Nothing
  tells the job that happened, and adding a change feed for it would be a
  second thing to keep correct. Recomputing the last few days every night is
  cheaper than being wrong, and rebuilding is idempotent by construction.
  """

  use Oban.Worker,
    queue: :reports,
    max_attempts: 3,
    unique: [period: 3600, states: [:available, :scheduled, :executing]]

  import Ecto.Query, warn: false

  alias Kaarobar.Reports.Rollups
  alias Kaarobar.Repo
  alias Kaarobar.Tenancy.Business

  require Logger

  # Far enough back to catch a late void or refund, short enough that the
  # nightly run stays a few seconds per shop.
  @lookback_days 3

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"business_id" => business_id} = args}) do
    case Repo.get(Business, business_id) do
      nil ->
        # The business was deleted between scheduling and running. Nothing to
        # roll up, and nothing worth retrying.
        :ok

      business ->
        lookback = Map.get(args, "lookback_days", @lookback_days)
        {:ok, _count} = Rollups.catch_up(business, lookback)
        :ok
    end
  end

  def perform(%Oban.Job{args: args}) do
    lookback = Map.get(args, "lookback_days", @lookback_days)
    businesses = active_business_ids()

    Enum.each(businesses, fn id ->
      %{business_id: id, lookback_days: lookback}
      |> new()
      |> Oban.insert()
    end)

    Logger.info("rollups: queued #{length(businesses)} business(es)")
    :ok
  end

  @doc "Queues a rebuild for one business now."
  @spec enqueue(Ecto.UUID.t(), keyword()) :: {:ok, Oban.Job.t()} | {:error, term()}
  def enqueue(business_id, opts \\ []) do
    %{
      business_id: business_id,
      lookback_days: Keyword.get(opts, :lookback_days, @lookback_days)
    }
    |> new()
    |> Oban.insert()
  end

  defp active_business_ids do
    Business
    |> where([b], is_nil(b.deleted_at))
    |> select([b], b.id)
    |> Repo.all()
  end
end
