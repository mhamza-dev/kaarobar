defmodule KaarobarWeb.UnitController do
  @moduledoc """
  Units of measure.

  Every business is seeded with the standard set when it is created, so this
  exists for the shop that needs something the defaults do not cover — a sack, a
  crate, a yard.
  """

  use KaarobarWeb, :controller

  # Four controllers share one view module; Phoenix would otherwise look for
  # a XxxJSON per controller.
  plug :put_view, json: KaarobarWeb.TaxonomyJSON

  alias Kaarobar.Audit
  alias Kaarobar.Catalog

  plug KaarobarWeb.Plugs.Authorize, [permission: "product:view"] when action in [:index]
  plug KaarobarWeb.Plugs.Authorize, [permission: "unit:manage"] when action in [:create]

  def index(conn, _params) do
    render(conn, :index, units: Catalog.list_units(conn.assigns.scope))
  end

  def create(conn, params) do
    scope = conn.assigns.scope

    with {:ok, unit} <- Catalog.create_unit(scope, params) do
      Audit.log(scope, "unit.created", unit)

      conn
      |> put_status(:created)
      |> render(:show, unit: unit)
    end
  end
end
