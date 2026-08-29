defmodule KaarobarWeb do
  @moduledoc """
  The entrypoint for defining your web interface, such
  as controllers, channels, and so on.

  This is a JSON API. There are no HTML views, templates or layouts: the
  clients are `desktop/cloud`, `web/main` and `mobile/staff`, and the contract
  between them and this application is the OpenAPI spec served at `/api/docs`.

  This can be used in your application as:

      use KaarobarWeb, :controller

  The definitions below will be executed for every controller, so keep them
  short and clean, focused on imports, uses and aliases.

  Do NOT define functions inside the quoted expressions below. Instead, define
  additional modules and import those modules here.
  """

  def static_paths, do: ~w(favicon.ico robots.txt)

  def router do
    quote do
      use Phoenix.Router, helpers: false

      # Import common connection and controller functions to use in pipelines
      import Plug.Conn
      import Phoenix.Controller
    end
  end

  def channel do
    quote do
      use Phoenix.Channel
    end
  end

  def controller do
    quote do
      use Phoenix.Controller, formats: [:json]

      use Gettext, backend: KaarobarWeb.Gettext

      import Plug.Conn

      action_fallback KaarobarWeb.FallbackController

      unquote(verified_routes())
    end
  end

  @doc """
  Used by JSON view modules. Keeps rendering helpers in one place so every
  resource serialises consistently.
  """
  def json do
    quote do
      import KaarobarWeb.JSONHelpers
    end
  end

  def verified_routes do
    quote do
      use Phoenix.VerifiedRoutes,
        endpoint: KaarobarWeb.Endpoint,
        router: KaarobarWeb.Router,
        statics: KaarobarWeb.static_paths()
    end
  end

  @doc """
  When used, dispatch to the appropriate controller/channel/etc.
  """
  defmacro __using__(which) when is_atom(which) do
    apply(__MODULE__, which, [])
  end
end
