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
    maintenance: 5,
    # Reporting invoices to tax authorities. Its own queue because a revenue
    # authority being down for an hour must not back up behind it every email
    # and every webhook the platform also owes somebody.
    fiscal: 5
  ],
  plugins: [
    # Submissions carry their own `retry_after`, so this only has to look often
    # enough to notice one coming due. A minute is well inside the grace period
    # every real-time regime allows.
    {Oban.Plugins.Cron,
     crontab: [
       {"* * * * *", Kaarobar.Fiscal.RetryWorker},
       # Hourly, not by the minute. Dunning intervals are measured in days, and
       # an organization's grace should not end at a minute's precision — the
       # difference between being cut off at 09:00 and at 09:47 matters to the
       # person it happens to and to nobody else.
       {"0 * * * *", Kaarobar.Billing.DunningWorker}
     ]}
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
