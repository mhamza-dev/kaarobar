defmodule KaarobarWeb.OptionTypeController do
  @moduledoc """
  The axes products vary along: Size, Colour, Flavour.

  Created with their values in one call, because an option type with no values
  cannot produce a variant and so is never what anyone actually wants.
  """

  use KaarobarWeb, :controller

  # Four controllers share one view module; Phoenix would otherwise look for
  # a XxxJSON per controller.
  plug :put_view, json: KaarobarWeb.TaxonomyJSON

  alias Kaarobar.Audit
  alias Kaarobar.Catalog

  plug KaarobarWeb.Plugs.Authorize, [permission: "product:view"] when action in [:index, :show]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "variant:manage"] when action in [:create, :create_value]

  def index(conn, _params) do
    render(conn, :index, option_types: Catalog.list_option_types(conn.assigns.scope))
  end

  def show(conn, %{"id" => id}) do
    with {:ok, option_type} <- Catalog.fetch_option_type(conn.assigns.scope, id) do
      render(conn, :show, option_type: option_type)
    end
  end

  @doc """
  Creates an option type.

  Pass `values` as a list of strings, or of maps with `value` and `hex_color`
  for swatches.
  """
  def create(conn, params) do
    scope = conn.assigns.scope

    with {:ok, option_type} <- Catalog.create_option_type(scope, params) do
      Audit.log(scope, "option_type.created", option_type)

      conn
      |> put_status(:created)
      |> render(:show, option_type: option_type)
    end
  end

  @doc "Adds a value to an existing option type."
  def create_value(conn, %{"option_type_id" => option_type_id} = params) do
    scope = conn.assigns.scope

    with {:ok, option_type} <- Catalog.fetch_option_type(scope, option_type_id),
         {:ok, _value} <- Catalog.create_option_value(scope, option_type, params),
         {:ok, reloaded} <- Catalog.fetch_option_type(scope, option_type_id) do
      conn
      |> put_status(:created)
      |> render(:show, option_type: reloaded)
    end
  end
end
