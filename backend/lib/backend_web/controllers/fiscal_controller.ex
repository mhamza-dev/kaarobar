defmodule KaarobarWeb.FiscalController do
  @moduledoc """
  The tax authority connection, and the invoices waiting on it.

  ## The screen that matters is the backlog

  `index` defaults to everything, but `?needs_attention=true` is what somebody
  opens this on: the rejected and the failed. A submission that was accepted
  needs nobody's attention ever again, and a list that buries eleven problems
  under four thousand successes is a list nobody checks.

  ## Credentials never come back out

  The serialiser omits them. A shop that has lost its authority token replaces
  it rather than reading it back — which is also what the authority would tell
  them to do, since a token that can file returns in their name is not
  something to leave lying in a JSON response.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Fiscal
  alias Kaarobar.Fiscal.RetryWorker

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "fiscal:configure"] when action in [:config, :configure, :disable]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "fiscal:view"] when action in [:index, :show, :status]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "fiscal:retry"] when action in [:retry, :retry_all]

  # --- Configuration ----------------------------------------------------------

  def config(conn, _params) do
    render(conn, :config, config: Fiscal.config(conn.assigns.scope))
  end

  def configure(conn, params) do
    with {:ok, config} <- Fiscal.upsert_config(conn.assigns.scope, params) do
      render(conn, :config, config: config)
    end
  end

  def disable(conn, _params) do
    with {:ok, config} <- Fiscal.disable_config(conn.assigns.scope) do
      render(conn, :config, config: config)
    end
  end

  # --- Submissions ------------------------------------------------------------

  def index(conn, params) do
    opts =
      []
      |> put_option(:status, params["status"])
      |> put_option(:needs_attention, params["needs_attention"] in ["true", true])

    render(conn, :submissions,
      submissions: Fiscal.list_submissions(conn.assigns.scope, opts)
    )
  end

  def show(conn, %{"id" => id}) do
    with {:ok, submission} <- Fiscal.fetch_submission(conn.assigns.scope, id) do
      render(conn, :submission, submission: submission)
    end
  end

  @doc """
  How far behind the shop is.

  One number, because it is the number that decides whether anybody has to do
  anything today — and, for a business selling under `block_on_failure`, the
  number that decides whether the till is open.
  """
  def status(conn, _params) do
    scope = conn.assigns.scope
    config = Fiscal.config(scope)

    render(conn, :status,
      config: config,
      backlog: Fiscal.backlog_count(scope)
    )
  end

  def retry(conn, %{"id" => id}) do
    with {:ok, submission} <- Fiscal.retry(conn.assigns.scope, id) do
      render(conn, :submission, submission: submission)
    end
  end

  @doc """
  Puts the whole queue through again now.

  Queued rather than run inline: a shop that has been offline all afternoon may
  have hundreds waiting, and sending them one at a time inside a web request
  would time out somewhere in the middle with no record of how far it got.
  """
  def retry_all(conn, _params) do
    with {:ok, _job} <- RetryWorker.enqueue() do
      conn |> put_status(:accepted) |> render(:queued, queued: true)
    end
  end

  defp put_option(opts, _key, nil), do: opts
  defp put_option(opts, _key, false), do: opts
  defp put_option(opts, key, value), do: Keyword.put(opts, key, value)
end
