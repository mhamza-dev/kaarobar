import Config

# Configure your database.
#
# Hostname defaults to "localhost" for a native Postgres, and is overridden to
# "db" by docker-compose. See README for the Docker workflow.
config :backend, Kaarobar.Repo,
  username: System.get_env("DATABASE_USER", "postgres"),
  password: System.get_env("DATABASE_PASSWORD", "postgres"),
  hostname: System.get_env("DATABASE_HOST", "localhost"),
  database: System.get_env("DATABASE_NAME", "backend_dev"),
  stacktrace: true,
  show_sensitive_data_on_connection_error: true,
  pool_size: 10

# For development, we disable any cache and enable
# debugging and code reloading.
config :backend, KaarobarWeb.Endpoint,
  # Bind on all interfaces so the containerised server is reachable from the
  # host. Docker publishes only the mapped port.
  http: [ip: {0, 0, 0, 0}, port: String.to_integer(System.get_env("PORT", "4000"))],
  check_origin: false,
  code_reloader: true,
  debug_errors: true,
  secret_key_base: "v3nVIslLIUyj9mN1AD1Y1MIXL+ypST6NUeMaLEG2KmwkZz4DUXiK9IQiAwJPXlTU"

# Enable dev routes for dashboard and mailbox
config :backend, dev_routes: true

# Do not include metadata nor timestamps in development logs
config :logger, :default_formatter, format: "[$level] $message\n"

# Set a higher stacktrace during development. Avoid configuring such
# in production as building large stacktraces may be expensive.
config :phoenix, :stacktrace_depth, 20

# Initialize plugs at runtime for faster development compilation
config :phoenix, :plug_init_mode, :runtime

# Disable swoosh api client as it is only required for production adapters.
config :swoosh, :api_client, false
