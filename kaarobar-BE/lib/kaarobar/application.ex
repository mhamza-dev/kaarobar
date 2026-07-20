defmodule Kaarobar.Application do
  @moduledoc false
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      KaarobarWeb.Telemetry,
      Kaarobar.Repo,
      {DNSCluster, query: Application.get_env(:kaarobar, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Kaarobar.PubSub},
      {Finch, name: Kaarobar.Finch},
      {Oban, Application.fetch_env!(:kaarobar, Oban)},
      KaarobarWeb.Endpoint
    ]

    opts = [strategy: :one_for_one, name: Kaarobar.Supervisor]
    Supervisor.start_link(children, opts)
  end

  @impl true
  def config_change(changed, _new, removed) do
    KaarobarWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
