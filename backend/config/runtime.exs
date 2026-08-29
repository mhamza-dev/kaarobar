import Config

# config/runtime.exs is executed for all environments, including
# during releases. It is executed after compilation and before the
# system starts, so it is typically used to load production configuration
# and secrets from environment variables or elsewhere. Do not define
# any compile-time configuration in here, as it won't be applied.

# ## Using releases
#
# If you use `mix release`, you need to explicitly enable the server
# by passing the PHX_SERVER=true when you start it:
#
#     PHX_SERVER=true bin/backend start
#
# Alternatively, `bin/server` (see rel/overlays) does this for you.
if System.get_env("PHX_SERVER") do
  config :backend, KaarobarWeb.Endpoint, server: true
end

config :backend, KaarobarWeb.Endpoint,
  http: [port: String.to_integer(System.get_env("PORT", "4000"))]

# ----------------------------------------------------------------------------
# Cross-origin access
#
# The API is consumed by browser clients on other origins (web/main,
# desktop/cloud). Native clients (mobile/staff) are unaffected by CORS.
# ----------------------------------------------------------------------------
cors_origins =
  System.get_env("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173")
  |> String.split(",", trim: true)
  |> Enum.map(&String.trim/1)
  |> Enum.reject(&(&1 == ""))

config :backend, :cors_origins, cors_origins

# The client application that owns the pages behind emailed links — password
# reset, email confirmation, invitation acceptance. The API sends people to the
# frontend, never to itself: these flows end in a form, and this is a JSON API.
config :backend,
       :frontend_url,
       System.get_env("FRONTEND_URL", List.first(cors_origins) || "http://localhost:3000")

config :backend, :mail_from_name, System.get_env("MAIL_FROM_NAME", "Kaarobar")
config :backend, :mail_from_address, System.get_env("MAIL_FROM_ADDRESS", "no-reply@kaarobar.app")

# ----------------------------------------------------------------------------
# Encryption at rest
#
# Used for gateway credentials, TOTP secrets and PII. The dev/test fallback is
# a published constant and is NEVER acceptable in production, which is why the
# prod branch below raises when CLOAK_KEY is absent.
# ----------------------------------------------------------------------------
dev_cloak_key = "e2xKQ0lWNjZmSmZqM2NWWXk1c2h1WHV3aVJqNGRnT0k9"

cloak_key =
  case System.get_env("CLOAK_KEY") do
    nil ->
      if config_env() == :prod do
        raise """
        environment variable CLOAK_KEY is missing.
        Generate one with: openssl rand -base64 32
        """
      else
        dev_cloak_key
      end

    value ->
      value
  end

config :backend, Kaarobar.Vault,
  ciphers: [
    default: {Cloak.Ciphers.AES.GCM, tag: "AES.GCM.V1", key: Base.decode64!(cloak_key)}
  ]

if config_env() == :prod do
  database_url =
    System.get_env("DATABASE_URL") ||
      raise """
      environment variable DATABASE_URL is missing.
      For example: ecto://USER:PASS@HOST/DATABASE
      """

  maybe_ipv6 = if System.get_env("ECTO_IPV6") in ~w(true 1), do: [:inet6], else: []

  config :backend, Kaarobar.Repo,
    # ssl: true,
    url: database_url,
    pool_size: String.to_integer(System.get_env("POOL_SIZE") || "10"),
    socket_options: maybe_ipv6

  # The secret key base is used to sign/encrypt cookies and other secrets.
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise """
      environment variable SECRET_KEY_BASE is missing.
      You can generate one by calling: mix phx.gen.secret
      """

  host = System.get_env("PHX_HOST") || "example.com"

  config :backend, :dns_cluster_query, System.get_env("DNS_CLUSTER_QUERY")

  config :backend, KaarobarWeb.Endpoint,
    url: [host: host, port: 443, scheme: "https"],
    http: [
      # Enable IPv6 and bind on all interfaces.
      ip: {0, 0, 0, 0, 0, 0, 0, 0}
    ],
    secret_key_base: secret_key_base

  # ## Configuring the mailer
  #
  #     config :backend, Kaarobar.Mailer,
  #       adapter: Swoosh.Adapters.Mailgun,
  #       api_key: System.get_env("MAILGUN_API_KEY"),
  #       domain: System.get_env("MAILGUN_DOMAIN")
  #
  # See https://swoosh.hexdocs.pm/Swoosh.html#module-installation for details.
end
