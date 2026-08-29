# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config

config :backend,
  namespace: Kaarobar,
  env: config_env(),
  ecto_repos: [Kaarobar.Repo],
  generators: [timestamp_type: :utc_datetime_usec, binary_id: true]

# Configure the endpoint. This is an API-only application: there is no asset
# pipeline and every error renders as JSON.
config :backend, KaarobarWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [json: KaarobarWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: Kaarobar.PubSub,
  live_view: [signing_salt: "tG7NRLgI"]

# Background job processing.
#
# Queues are separated by failure domain rather than by feature: a payment
# gateway timing out must not stop receipts from being emailed, and a slow
# month-end report must not delay a webhook retry.
#
# Cron entries are added by the phases that own them (rollups, expiry alerts,
# dunning, token cleanup).
config :backend, Oban,
  repo: Kaarobar.Repo,
  engine: Oban.Engines.Basic,
  queues: [
    default: 10,
    mailers: 20,
    webhooks: 10,
    reports: 5,
    payments: 10,
    notifications: 20,
    maintenance: 5
  ]

# Configure the mailer
#
# By default it uses the "Local" adapter which stores the emails
# locally. You can see the emails in your browser, at "/dev/mailbox".
#
# For production it's recommended to configure a different adapter
# at the `config/runtime.exs`.
config :backend, Kaarobar.Mailer, adapter: Swoosh.Adapters.Local

# Configure Elixir's Logger
config :logger, :default_formatter,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id, :organization_id, :business_id, :user_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{config_env()}.exs"
