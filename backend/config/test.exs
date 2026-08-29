import Config

# Configure your database
#
# The MIX_TEST_PARTITION environment variable can be used
# to provide built-in test partitioning in CI environment.
# Run `mix help test` for more information.
config :backend, Kaarobar.Repo,
  username: System.get_env("DATABASE_USER", "postgres"),
  password: System.get_env("DATABASE_PASSWORD", "postgres"),
  hostname: System.get_env("DATABASE_HOST", "localhost"),
  database: "backend_test#{System.get_env("MIX_TEST_PARTITION")}",
  pool: Ecto.Adapters.SQL.Sandbox,
  pool_size: System.schedulers_online() * 2

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :backend, KaarobarWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "PMxwJ5Fg1L4FN3sZrBSK2vXoAVd68vVIBvVK3AKP8s9CjRrUHzblwKOplFEP1d3f",
  server: false

# In test we don't send emails
config :backend, Kaarobar.Mailer, adapter: Swoosh.Adapters.Test

# Disable swoosh api client as it is only required for production adapters
config :swoosh, :api_client, false

# Jobs are asserted on explicitly rather than executed in the background.
config :backend, Oban, testing: :manual

# Argon2 is deliberately slow. Use the cheapest parameters in test.
config :argon2_elixir, t_cost: 1, m_cost: 8

# Throttling is off by default here: every test request comes from 127.0.0.1,
# so one shared bucket would couple independent async tests together. The
# rate-limiting tests switch it on for themselves.
config :backend, :rate_limiting, false

# Print only warnings and errors during test
config :logger, level: :warning

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime

# Sort query params output of verified routes for robust url comparisons
config :phoenix,
  sort_verified_routes_query_params: true
