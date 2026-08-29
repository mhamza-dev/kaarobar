defmodule Kaarobar.Application do
  # See https://elixir.hexdocs.pm/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      KaarobarWeb.Telemetry,
      Kaarobar.Repo,
      # The vault must be running before any schema with an encrypted field is
      # loaded, and before Oban picks up a job that touches one.
      Kaarobar.Vault,
      {DNSCluster, query: Application.get_env(:backend, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Kaarobar.PubSub},
      {Oban, Application.fetch_env!(:backend, Oban)},
      {Kaarobar.RateLimiter, [clean_period: :timer.minutes(1)]},
      # Start to serve requests, typically the last entry
      KaarobarWeb.Endpoint
    ]

    # See https://elixir.hexdocs.pm/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Kaarobar.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    KaarobarWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
