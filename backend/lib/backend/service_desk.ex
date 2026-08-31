defmodule Kaarobar.ServiceDesk do
  @moduledoc """
  Work taken in and given back: laundry, ironing, tailoring, repairs.

  ## The shop is holding somebody's property

  Every design decision here follows from that. Items are tracked individually
  because a customer brings nine shirts and a coat and collects the coat first.
  Each carries a rack location, because "it is here somewhere" is what loses a
  customer for good. Each carries the condition it arrived in, because the
  argument about the stain that was already there is the one this trade always
  has — and the shop only wins it if somebody wrote it down before the customer
  left.

  ## Every move is recorded where the customer can see it

  `Kaarobar.ServiceDesk.JobEvent` is a separate trail from `Kaarobar.Audit`.
  The audit log is for the shop and its regulators; this is the answer to
  "where is my coat?", and it has to be showable to the person asking.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Audit
  alias Kaarobar.Money
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Scope
  alias Kaarobar.Sequences
  alias Kaarobar.ServiceDesk.Job
  alias Kaarobar.ServiceDesk.JobEvent
  alias Kaarobar.ServiceDesk.JobItem

  # ===========================================================================
  # Intake
  # ===========================================================================

  @doc """
  Takes work in.

  The job and all of its items are written in one transaction, then an
  intake event. A job whose items half-saved is a customer whose property the
  shop has no record of holding.

  `quoted_total` is summed from the items unless the caller names one, so a
  counter can price per garment and get a total without doing arithmetic.
  """
  @spec take_in(Scope.t(), map()) :: {:ok, Job.t()} | {:error, term()}
  def take_in(%Scope{} = scope, attrs) do
    attrs = stringify(attrs)
    lines = attrs |> Map.get("items", []) |> Enum.map(&stringify/1)

    Repo.transaction(fn ->
      with :ok <- ensure_items_given(lines),
           {:ok, number} <- Sequences.next(scope, "service_job"),
           {:ok, job} <- insert_job(scope, attrs, number, lines),
           {:ok, _items} <- insert_items(scope, job, lines),
           {:ok, _event} <- record(scope, job, "received", intake_summary(job, lines)) do
        Audit.log(scope, "service_job.received", job,
          entity_type: "service_job",
          label: job.number
        )

        reload(scope, job.id)
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc """
  Jobs on the counter's screen.

  ## Options

    * `:status` — defaults to everything the shop is still holding, because a
      list dominated by delivered work is not what anybody opens this for.
    * `:overdue` — only what has missed its promise.
    * `:customer_id`, `:assigned_to_id`
  """
  @spec list_jobs(Scope.t(), keyword()) :: [Job.t()]
  def list_jobs(%Scope{} = scope, opts \\ []) do
    Job
    |> Scoped.for_branch(scope)
    |> filter_status(Keyword.get(opts, :status))
    |> filter_overdue(Keyword.get(opts, :overdue))
    |> filter_by(:customer_id, Keyword.get(opts, :customer_id))
    |> filter_by(:assigned_to_id, Keyword.get(opts, :assigned_to_id))
    |> order_by([job], asc_nulls_last: job.promised_on, asc: job.id)
    |> preload([:customer, :items])
    |> Repo.all()
  end

  @doc "Fetches a job with its items."
  @spec fetch_job(Scope.t(), Ecto.UUID.t()) :: {:ok, Job.t()} | {:error, :not_found}
  def fetch_job(%Scope{} = scope, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      Job
      |> Scoped.for_business(scope)
      |> where([job], job.id == ^id)
      |> preload([:customer, :items])
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        job -> {:ok, job}
      end
    else
      {:error, :not_found}
    end
  end

  @doc """
  Finds the job an item's tag belongs to.

  How a counter actually works: somebody hands over a ticket or a garment with
  a tag on it, and the tag is scanned. Searching by job number requires the
  customer to have kept the paper.
  """
  @spec find_by_tag(Scope.t(), String.t()) :: {:ok, Job.t()} | {:error, :not_found}
  def find_by_tag(%Scope{} = scope, tag_code) when is_binary(tag_code) do
    normalized = tag_code |> String.trim() |> String.upcase()

    JobItem
    |> Scoped.for_business(scope)
    |> where([item], item.tag_code == ^normalized)
    |> select([item], item.service_job_id)
    |> Repo.one()
    |> case do
      nil -> {:error, :not_found}
      job_id -> fetch_job(scope, job_id)
    end
  end

  @doc "The trail the customer is entitled to see."
  @spec history(Scope.t(), Job.t(), keyword()) :: [JobEvent.t()]
  def history(%Scope{} = scope, %Job{} = job, opts \\ []) do
    events =
      JobEvent
      |> Scoped.for_business(scope)
      |> where([event], event.service_job_id == ^job.id)
      |> order_by([event], asc: event.occurred_at, asc: event.id)
      |> Repo.all()

    if Keyword.get(opts, :customer_visible, false) do
      Enum.filter(events, &JobEvent.customer_visible?/1)
    else
      events
    end
  end

  # ===========================================================================
  # Progress
  # ===========================================================================

  @doc "Work has begun."
  @spec start(Scope.t(), Job.t()) :: {:ok, Job.t()} | {:error, term()}
  def start(%Scope{} = scope, %Job{} = job) do
    advance(scope, job, Job.start_changeset(job), "started", "Work started")
  end

  @doc """
  Finished and on the rack.

  A rack location is required, and refused without one. A job that is ready but
  unfindable is a job that is not ready.
  """
  @spec mark_ready(Scope.t(), Job.t(), String.t()) :: {:ok, Job.t()} | {:error, term()}
  def mark_ready(%Scope{} = scope, %Job{} = job, rack_location) do
    Repo.transaction(fn ->
      changeset = Job.ready_changeset(job, rack_location)

      with {:ok, ready} <- Repo.update(changeset),
           :ok <- mark_items_ready(scope, ready, rack_location),
           {:ok, _event} <- record(scope, ready, "ready", "Ready at #{ready.rack_location}") do
        reload(scope, ready.id)
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc """
  Hands the work back.

  Refused while money is still owed, unless the caller says otherwise: handing
  over a customer's property and their unpaid bill at the same time is how a
  laundry writes off a week's takings one coat at a time.
  """
  @spec deliver(Scope.t(), Job.t(), keyword()) :: {:ok, Job.t()} | {:error, term()}
  def deliver(%Scope{} = scope, %Job{} = job, opts \\ []) do
    allow_unpaid = Keyword.get(opts, :allow_unpaid, false)

    if not allow_unpaid and Money.positive?(Job.balance_due(job)) do
      {:error, {:balance_due, Job.balance_due(job)}}
    else
      Repo.transaction(fn ->
        changeset = Job.deliver_changeset(job, Scope.user_id(scope))

        with {:ok, delivered} <- Repo.update(changeset),
             :ok <- mark_items_delivered(scope, delivered),
             {:ok, _event} <- record(scope, delivered, "delivered", "Handed back") do
          Audit.log(scope, "service_job.delivered", delivered,
            entity_type: "service_job",
            label: delivered.number
          )

          reload(scope, delivered.id)
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end
  end

  @doc "Pauses the job — waiting on a part, or on the customer."
  @spec hold(Scope.t(), Job.t(), String.t()) :: {:ok, Job.t()} | {:error, term()}
  def hold(%Scope{} = scope, %Job{} = job, reason) do
    advance(scope, job, Job.hold_changeset(job), "note", "On hold: #{reason}")
  end

  @doc "Calls the job off. A reason is required."
  @spec cancel(Scope.t(), Job.t(), String.t()) :: {:ok, Job.t()} | {:error, term()}
  def cancel(%Scope{} = scope, %Job{} = job, reason) do
    advance(scope, job, Job.cancel_changeset(job, reason), "cancelled", "Cancelled: #{reason}")
  end

  @doc "Updates a job's details — assignment, rack, notes, quote."
  @spec update_job(Scope.t(), Job.t(), map()) :: {:ok, Job.t()} | {:error, Ecto.Changeset.t()}
  def update_job(%Scope{}, %Job{} = job, attrs),
    do: job |> Job.changeset(stringify(attrs)) |> Repo.update()

  @doc """
  Moves one item to a different rack position.

  Recorded, because losing track of where something was moved to is the same
  failure as losing it.
  """
  @spec move_item(Scope.t(), Job.t(), Ecto.UUID.t(), String.t()) ::
          {:ok, JobItem.t()} | {:error, term()}
  def move_item(%Scope{} = scope, %Job{} = job, item_id, rack_location) do
    with {:ok, item} <- fetch_item(scope, job, item_id) do
      Repo.transaction(fn ->
        changeset = JobItem.changeset(item, %{"rack_location" => rack_location})

        with {:ok, moved} <- Repo.update(changeset),
             {:ok, _event} <-
               record(scope, job, "moved", "#{JobItem.label(moved)} moved to #{rack_location}",
                 item_id: moved.id
               ) do
          moved
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end
  end

  @doc """
  Records that something went wrong with the customer's property.

  A state on the item rather than a note, because a shop that cannot count how
  often it loses or ruins things cannot fix it.
  """
  @spec report_incident(Scope.t(), Job.t(), Ecto.UUID.t(), String.t(), String.t()) ::
          {:ok, JobItem.t()} | {:error, term()}
  def report_incident(%Scope{} = scope, %Job{} = job, item_id, status, notes)
      when status in ["lost", "damaged"] do
    with {:ok, item} <- fetch_item(scope, job, item_id) do
      Repo.transaction(fn ->
        changeset = JobItem.incident_changeset(item, status, notes)

        with {:ok, flagged} <- Repo.update(changeset),
             {:ok, _event} <-
               record(scope, job, "issue", "#{JobItem.label(flagged)} #{status}",
                 item_id: flagged.id,
                 detail: notes
               ) do
          Audit.log(scope, "service_job.incident", job,
            entity_type: "service_job",
            label: job.number,
            summary: "#{JobItem.label(flagged)} reported #{status}"
          )

          flagged
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end
  end

  @doc "Adds a note to the trail — a call made, a message sent."
  @spec add_note(Scope.t(), Job.t(), String.t(), keyword()) ::
          {:ok, JobEvent.t()} | {:error, term()}
  def add_note(%Scope{} = scope, %Job{} = job, summary, opts \\ []),
    do: record(scope, job, Keyword.get(opts, :kind, "note"), summary, opts)

  @doc "Jobs that have missed their promise and are still in the shop."
  @spec overdue(Scope.t()) :: [Job.t()]
  def overdue(%Scope{} = scope), do: list_jobs(scope, overdue: true)

  # ===========================================================================
  # Internal
  # ===========================================================================

  defp ensure_items_given([]), do: {:error, :items_required}
  defp ensure_items_given(items) when is_list(items), do: :ok
  defp ensure_items_given(_other), do: {:error, :items_required}

  defp insert_job(%Scope{} = scope, attrs, number, lines) do
    %Job{}
    |> Job.changeset(
      Map.merge(attrs, %{
        "organization_id" => Scope.organization_id(scope),
        "business_id" => Scope.business_id(scope),
        "branch_id" => Map.get(attrs, "branch_id") || Scope.branch_id(scope),
        "number" => number,
        "received_at" => Map.get(attrs, "received_at") || DateTime.utc_now(),
        "received_by_id" => Scope.user_id(scope),
        "quoted_total" => Map.get(attrs, "quoted_total") || quoted_from(lines)
      })
    )
    |> Repo.insert()
  end

  # A counter prices per garment; the total should not have to be typed again.
  defp quoted_from(lines) do
    lines
    |> Enum.map(fn line ->
      quantity = line |> Map.get("quantity", 1) |> Money.to_decimal()
      price = line |> Map.get("unit_price", 0) |> Money.to_decimal()
      Money.mult(quantity, price)
    end)
    |> Money.sum()
    |> Money.round()
  end

  defp insert_items(%Scope{} = scope, %Job{} = job, lines) do
    lines
    |> Enum.with_index()
    |> Enum.reduce_while({:ok, []}, fn {line, position}, {:ok, acc} ->
      changeset =
        %JobItem{}
        |> JobItem.changeset(
          Map.merge(line, %{
            "business_id" => Scope.business_id(scope),
            "service_job_id" => job.id,
            "position" => position
          })
        )

      case Repo.insert(changeset) do
        {:ok, item} -> {:cont, {:ok, [item | acc]}}
        {:error, failure} -> {:halt, {:error, failure}}
      end
    end)
    |> case do
      {:ok, items} -> {:ok, Enum.reverse(items)}
      other -> other
    end
  end

  # The job is matched for its type but never read: the changeset already
  # carries it, and taking the row again here would be reading a copy that the
  # update in this transaction has already superseded.
  defp advance(%Scope{} = scope, %Job{}, changeset, kind, summary) do
    Repo.transaction(fn ->
      with {:ok, updated} <- Repo.update(changeset),
           {:ok, _event} <- record(scope, updated, kind, summary) do
        reload(scope, updated.id)
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  defp record(%Scope{} = scope, %Job{} = job, kind, summary, opts \\ []) do
    %JobEvent{}
    |> JobEvent.changeset(%{
      business_id: Scope.business_id(scope),
      service_job_id: job.id,
      service_job_item_id: Keyword.get(opts, :item_id),
      kind: kind,
      summary: summary,
      detail: Keyword.get(opts, :detail),
      actor_user_id: Scope.user_id(scope),
      actor_label: scope.user && scope.user.name
    })
    |> Repo.insert()
  end

  defp intake_summary(%Job{} = job, lines) do
    count = length(lines)
    promised = if job.promised_on, do: ", promised #{Date.to_iso8601(job.promised_on)}", else: ""
    "#{count} item(s) received#{promised}"
  end

  defp mark_items_ready(%Scope{} = scope, %Job{} = job, rack_location) do
    JobItem
    |> Scoped.for_business(scope)
    |> where([item], item.service_job_id == ^job.id)
    |> where([item], item.status in ["intake", "in_progress"])
    |> Repo.update_all(
      set: [status: "ready", rack_location: rack_location, ready_at: DateTime.utc_now()]
    )

    :ok
  end

  defp mark_items_delivered(%Scope{} = scope, %Job{} = job) do
    JobItem
    |> Scoped.for_business(scope)
    |> where([item], item.service_job_id == ^job.id)
    |> where([item], item.status in ["intake", "in_progress", "ready"])
    |> Repo.update_all(set: [status: "delivered", delivered_at: DateTime.utc_now()])

    :ok
  end

  defp fetch_item(%Scope{} = scope, %Job{} = job, item_id) do
    JobItem
    |> Scoped.for_business(scope)
    |> where([item], item.id == ^item_id and item.service_job_id == ^job.id)
    |> Repo.one()
    |> case do
      nil -> {:error, :not_found}
      item -> {:ok, item}
    end
  end

  defp reload(%Scope{} = scope, id) do
    {:ok, job} = fetch_job(scope, id)
    job
  end

  defp filter_status(query, nil),
    do: where(query, [job], job.status in ^Job.holding_statuses())

  defp filter_status(query, "all"), do: query
  defp filter_status(query, status), do: where(query, [job], job.status == ^status)

  defp filter_overdue(query, true) do
    today = Date.utc_today()

    query
    |> where([job], not is_nil(job.promised_on) and job.promised_on < ^today)
    |> where([job], job.status in ^Job.holding_statuses())
  end

  defp filter_overdue(query, _other), do: query

  defp filter_by(query, _field, nil), do: query
  defp filter_by(query, :customer_id, value), do: where(query, [j], j.customer_id == ^value)
  defp filter_by(query, :assigned_to_id, value), do: where(query, [j], j.assigned_to_id == ^value)

  defp stringify(attrs) when is_map(attrs) do
    Map.new(attrs, fn {key, value} ->
      {if(is_atom(key), do: Atom.to_string(key), else: key), value}
    end)
  end

  defp stringify(other), do: other
end
