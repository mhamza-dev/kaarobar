defmodule KaarobarWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :backend

  # The session is used only by the development LiveDashboard. API requests
  # authenticate with bearer tokens and never rely on a cookie.
  @session_options [
    store: :cookie,
    key: "_backend_key",
    signing_salt: "Fm13aY1a",
    same_site: "Lax"
  ]

  socket "/live", Phoenix.LiveView.Socket,
    websocket: [connect_info: [session: @session_options]],
    longpoll: [connect_info: [session: @session_options]]

  # Realtime channels for the POS clients: live sales feeds, kitchen displays,
  # register state, stock updates. Handlers are added by the phases that own them.
  socket "/socket", KaarobarWeb.UserSocket,
    websocket: [connect_info: [:peer_data, :user_agent, :x_headers]],
    longpoll: false

  # Serve favicon.ico and robots.txt. There is no asset pipeline: this is a
  # JSON API.
  plug Plug.Static,
    at: "/",
    from: :backend,
    gzip: false,
    only: KaarobarWeb.static_paths()

  # Code reloading can be explicitly enabled under the
  # :code_reloader configuration of your endpoint.
  if code_reloading? do
    plug Phoenix.CodeReloader
    plug Phoenix.Ecto.CheckRepoStatus, otp_app: :backend
  end

  plug Phoenix.LiveDashboard.RequestLogger,
    param_key: "request_logger",
    cookie_key: "request_logger"

  plug Plug.RequestId
  plug Plug.Telemetry, event_prefix: [:phoenix, :endpoint]

  # Browser clients live on other origins. Must run before the router so that
  # preflight OPTIONS requests are answered without matching a route.
  plug Corsica,
    origins: {KaarobarWeb.CORS, :allowed?, []},
    allow_credentials: false,
    allow_headers: [
      "accept",
      "authorization",
      "content-type",
      "idempotency-key",
      "x-branch-id",
      "x-business-id",
      "x-organization-id",
      "x-register-id",
      "x-request-id"
    ],
    expose_headers: [
      "retry-after",
      "x-ratelimit-limit",
      "x-ratelimit-remaining",
      "x-request-id"
    ],
    max_age: 600

  plug Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    # Keeps the raw bytes on webhook paths. A gateway signs what it sent, and
    # re-encoding the parsed JSON produces different bytes that never verify.
    body_reader: {KaarobarWeb.CacheBodyReader, :read_body, []},
    json_decoder: Phoenix.json_library(),
    # Receipts with embedded images and bulk catalog imports are the largest
    # bodies we accept.
    length: 20_000_000

  plug Plug.MethodOverride
  plug Plug.Head
  plug Plug.Session, @session_options
  plug KaarobarWeb.Router
end
