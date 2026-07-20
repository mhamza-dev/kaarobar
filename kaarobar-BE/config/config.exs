# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config

config :kaarobar,
  ecto_repos: [Kaarobar.Repo],
  generators: [timestamp_type: :utc_datetime, binary_id: true]

# Configures the endpoint
config :kaarobar, KaarobarWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [json: KaarobarWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: Kaarobar.PubSub,
  live_view: [signing_salt: "2jWyKFol"]

# Configures the mailer
#
# By default it uses the "Local" adapter which stores the emails
# locally. You can see the emails in your browser, at "/dev/mailbox".
#
# For production it's recommended to configure a different adapter
# at the `config/runtime.exs`.
config :kaarobar, Kaarobar.Mailer, adapter: Swoosh.Adapters.Local

# Configures Elixir's Logger
config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

config :kaarobar, Kaarobar.Guardian,
  issuer: "kaarobar",
  secret_key: "dev-guardian-secret-change-in-production-kaarobar-2026"

config :kaarobar, Oban,
  repo: Kaarobar.Repo,
  plugins: [Oban.Plugins.Pruner],
  queues: [default: 10, accounting: 5, notifications: 5, integrations: 5]

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{config_env()}.exs"
