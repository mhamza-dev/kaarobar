defmodule KaarobarWeb.CORS do
  @moduledoc """
  Decides which browser origins may call the API.

  The allowlist comes from `CORS_ORIGINS` at runtime (see `config/runtime.exs`),
  so pointing a new deployment of `web/main` or `desktop/cloud` at this API is
  an environment change rather than a redeploy.

  There is no wildcard. The API is authenticated with bearer tokens rather than
  cookies, so a wildcard would not by itself leak a session, but it would let
  any page on the internet script a logged-in user's tenant if a token ever
  reached browser storage. Native clients (`mobile/staff`) do not send `Origin`
  and are unaffected by any of this.
  """

  @doc """
  Corsica's origin check.

  Corsica calls the `{module, function, args}` form with the connection and the
  request's origin prepended to `args`, hence the unused first parameter.
  """
  @spec allowed?(Plug.Conn.t(), String.t()) :: boolean()
  def allowed?(_conn, origin), do: allowed?(origin)

  @doc "True when the given origin is on the allowlist."
  @spec allowed?(String.t()) :: boolean()
  def allowed?(origin) when is_binary(origin), do: origin in allowed_origins()
  def allowed?(_origin), do: false

  @doc "The configured allowlist."
  @spec allowed_origins() :: [String.t()]
  def allowed_origins do
    Application.get_env(:backend, :cors_origins, [])
  end
end
