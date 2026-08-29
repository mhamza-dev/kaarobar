defmodule KaarobarWeb.TaxController do
  @moduledoc """
  Tax rates and the groups products are assigned to.

  Both live here because they are configured together and never separately: a
  rate with no group charges nobody, and a group with no rates charges nothing.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Audit
  alias Kaarobar.Taxes

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "product:view"] when action in [:index, :groups, :show_group]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "tax:manage"]
       when action in [
              :create,
              :update,
              :delete,
              :create_group,
              :update_group,
              :delete_group,
              :set_default_group
            ]

  @doc "Lists tax rates."
  def index(conn, _params) do
    render(conn, :index, taxes: Taxes.list_taxes(conn.assigns.scope))
  end

  @doc "Creates a tax rate. `rate` is a fraction — 0.17 for 17%."
  def create(conn, params) do
    scope = conn.assigns.scope

    with {:ok, tax} <- Taxes.create_tax(scope, params) do
      Audit.log(scope, "tax.created", tax, summary: "Created #{tax.name}")

      conn
      |> put_status(:created)
      |> render(:show, tax: tax)
    end
  end

  @doc """
  Updates a tax rate.

  Applies to future sales only — past sales store the tax lines that were
  actually charged, so an old invoice still shows the old rate.
  """
  def update(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, tax} <- Taxes.fetch_tax(scope, id),
         {:ok, updated} <- Taxes.update_tax(scope, tax, params) do
      Audit.log(scope, "tax.updated", updated,
        changes: %{before: %{rate: tax.rate}, after: %{rate: updated.rate}}
      )

      render(conn, :show, tax: updated)
    end
  end

  @doc "Deletes a tax rate. Refused while a group still contains it."
  def delete(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, tax} <- Taxes.fetch_tax(scope, id),
         {:ok, deleted} <- Taxes.delete_tax(scope, tax) do
      Audit.log(scope, "tax.deleted", deleted)
      send_resp(conn, :no_content, "")
    end
  end

  @doc "Lists tax groups with their rates."
  def groups(conn, _params) do
    render(conn, :groups, tax_groups: Taxes.list_tax_groups(conn.assigns.scope))
  end

  @doc "One tax group."
  def show_group(conn, %{"id" => id}) do
    with {:ok, group} <- Taxes.fetch_tax_group(conn.assigns.scope, id) do
      render(conn, :group, tax_group: group)
    end
  end

  @doc "Creates a tax group. Pass `tax_ids` to populate it in the same call."
  def create_group(conn, params) do
    scope = conn.assigns.scope

    with {:ok, group} <- Taxes.create_tax_group(scope, params) do
      Audit.log(scope, "tax_group.created", group)

      conn
      |> put_status(:created)
      |> render(:group, tax_group: group)
    end
  end

  @doc "Updates a tax group. Supplying `tax_ids` replaces its rates."
  def update_group(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, group} <- Taxes.fetch_tax_group(scope, id),
         {:ok, updated} <- Taxes.update_tax_group(scope, group, params) do
      Audit.log(scope, "tax_group.updated", updated)
      render(conn, :group, tax_group: updated)
    end
  end

  @doc "Makes a group the default, demoting the previous one."
  def set_default_group(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, group} <- Taxes.fetch_tax_group(scope, id),
         {:ok, promoted} <- Taxes.set_default_tax_group(scope, group) do
      Audit.log(scope, "tax_group.set_default", promoted)
      render(conn, :group, tax_group: promoted)
    end
  end

  @doc "Deletes a tax group. Refused while products still point at it."
  def delete_group(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, group} <- Taxes.fetch_tax_group(scope, id),
         {:ok, deleted} <- Taxes.delete_tax_group(scope, group) do
      Audit.log(scope, "tax_group.deleted", deleted)
      send_resp(conn, :no_content, "")
    end
  end
end
