defmodule KaarobarWeb.ServiceJobController do
  @moduledoc """
  Work taken in and given back.

  Handing the work back is a separate grant from updating it, because that is
  the moment the shop stops holding the customer's property and — usually —
  takes the money. `show_by_tag` is how a counter actually finds a job: somebody
  presents a garment or a ticket, and the tag is scanned.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.ServiceDesk

  plug KaarobarWeb.Plugs.Authorize, module: "service_jobs"

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "service_job:view"]
       when action in [:index, :show, :show_by_tag, :history, :overdue]

  plug KaarobarWeb.Plugs.Authorize, [permission: "service_job:create"] when action in [:create]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "service_job:update"]
       when action in [:update, :start, :ready, :hold, :cancel, :move_item, :report_incident, :add_note]

  plug KaarobarWeb.Plugs.Authorize, [permission: "service_job:deliver"] when action in [:deliver]

  def index(conn, params) do
    opts =
      []
      |> maybe_put(:status, params["status"])
      |> maybe_put(:customer_id, params["customer_id"])
      |> maybe_put(:assigned_to_id, params["assigned_to_id"])

    render(conn, :jobs, jobs: ServiceDesk.list_jobs(conn.assigns.scope, opts))
  end

  @doc "What has missed its promise and is still in the shop."
  def overdue(conn, _params) do
    render(conn, :jobs, jobs: ServiceDesk.overdue(conn.assigns.scope))
  end

  def show(conn, %{"id" => id}) do
    with {:ok, job} <- ServiceDesk.fetch_job(conn.assigns.scope, id) do
      render(conn, :job, job: job)
    end
  end

  @doc "Finds the job a scanned tag belongs to."
  def show_by_tag(conn, %{"tag" => tag}) do
    with {:ok, job} <- ServiceDesk.find_by_tag(conn.assigns.scope, tag) do
      render(conn, :job, job: job)
    end
  end

  def history(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope
    visible_only = params["customer_visible"] == "true"

    with {:ok, job} <- ServiceDesk.fetch_job(scope, id) do
      render(conn, :history,
        events: ServiceDesk.history(scope, job, customer_visible: visible_only)
      )
    end
  end

  def create(conn, params) do
    with {:ok, job} <- ServiceDesk.take_in(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:job, job: job)
    end
  end

  def update(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, job} <- ServiceDesk.fetch_job(scope, id),
         {:ok, updated} <- ServiceDesk.update_job(scope, job, params) do
      render(conn, :job, job: updated)
    end
  end

  def start(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, job} <- ServiceDesk.fetch_job(scope, id),
         {:ok, started} <- ServiceDesk.start(scope, job) do
      render(conn, :job, job: started)
    end
  end

  @doc "Finished and on the rack. A location is required."
  def ready(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, job} <- ServiceDesk.fetch_job(scope, id),
         {:ok, ready} <- ServiceDesk.mark_ready(scope, job, params["rack_location"]) do
      render(conn, :job, job: ready)
    end
  end

  @doc """
  Hands the work back.

  Refused while money is owed unless `allow_unpaid` is set — handing over the
  property and the unpaid bill together is how a laundry writes off a week's
  takings one coat at a time.
  """
  def deliver(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope
    opts = [allow_unpaid: params["allow_unpaid"] == true]

    with {:ok, job} <- ServiceDesk.fetch_job(scope, id),
         {:ok, delivered} <- ServiceDesk.deliver(scope, job, opts) do
      render(conn, :job, job: delivered)
    end
  end

  def hold(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, job} <- ServiceDesk.fetch_job(scope, id),
         {:ok, held} <- ServiceDesk.hold(scope, job, params["reason"] || "No reason given") do
      render(conn, :job, job: held)
    end
  end

  def cancel(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, job} <- ServiceDesk.fetch_job(scope, id),
         {:ok, cancelled} <- ServiceDesk.cancel(scope, job, params["reason"]) do
      render(conn, :job, job: cancelled)
    end
  end

  def move_item(conn, %{"id" => id, "item_id" => item_id} = params) do
    scope = conn.assigns.scope

    with {:ok, job} <- ServiceDesk.fetch_job(scope, id),
         {:ok, moved} <- ServiceDesk.move_item(scope, job, item_id, params["rack_location"]) do
      render(conn, :item, item: moved)
    end
  end

  @doc "Records that something was lost or damaged while the shop had it."
  def report_incident(conn, %{"id" => id, "item_id" => item_id, "status" => status} = params) do
    scope = conn.assigns.scope

    with {:ok, job} <- ServiceDesk.fetch_job(scope, id),
         :ok <- validate_incident(status),
         {:ok, flagged} <-
           ServiceDesk.report_incident(scope, job, item_id, status, params["notes"]) do
      render(conn, :item, item: flagged)
    end
  end

  def add_note(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, job} <- ServiceDesk.fetch_job(scope, id),
         {:ok, event} <-
           ServiceDesk.add_note(scope, job, params["summary"] || "", kind: params["kind"] || "note") do
      conn |> put_status(:created) |> render(:event, event: event)
    end
  end

  defp validate_incident(status) when status in ["lost", "damaged"], do: :ok
  defp validate_incident(_status), do: {:error, :invalid_incident_status}

  defp maybe_put(opts, _key, nil), do: opts
  defp maybe_put(opts, key, value), do: Keyword.put(opts, key, value)
end
