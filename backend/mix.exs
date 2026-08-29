defmodule Kaarobar.MixProject do
  use Mix.Project

  def project do
    [
      app: :backend,
      version: "0.1.0",
      elixir: "~> 1.17",
      elixirc_paths: elixirc_paths(Mix.env()),
      start_permanent: Mix.env() == :prod,
      aliases: aliases(),
      deps: deps(),
      releases: releases(),
      listeners: [Phoenix.CodeReloader]
    ]
  end

  # Configuration for the OTP application.
  #
  # Type `mix help compile.app` for more information.
  def application do
    [
      mod: {Kaarobar.Application, []},
      extra_applications: [:logger, :runtime_tools]
    ]
  end

  def cli do
    [
      preferred_envs: [precommit: :test]
    ]
  end

  # Specifies which paths to compile per environment.
  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib"]

  # Specifies your project dependencies.
  #
  # Type `mix help deps` for examples and options.
  defp deps do
    [
      # --- Web / persistence -------------------------------------------------
      {:phoenix, "~> 1.8.13"},
      {:phoenix_ecto, "~> 4.5"},
      {:ecto_sql, "~> 3.13"},
      {:postgrex, ">= 0.0.0"},
      {:phoenix_live_dashboard, "~> 0.8.3"},
      {:bandit, "~> 1.5"},

      # --- Platform ----------------------------------------------------------
      # Password hashing for staff and owner accounts.
      {:argon2_elixir, "~> 4.1"},
      # Background jobs: rollups, alerts, webhooks, dunning, exports.
      {:oban, "~> 2.19"},
      # Field-level encryption for gateway credentials, TOTP secrets, PII.
      {:cloak_ecto, "~> 1.3"},
      # Browser clients (web/main, desktop/cloud) are cross-origin.
      {:corsica, "~> 2.1"},
      # Per-endpoint request throttling.
      {:hammer, "~> 7.0"},
      # OpenAPI 3 spec — the contract handed to the frontend apps.
      {:open_api_spex, "~> 3.21"},

      # --- Support -----------------------------------------------------------
      {:swoosh, "~> 1.16"},
      {:req, "~> 0.5"},
      {:telemetry_metrics, "~> 1.0"},
      {:telemetry_poller, "~> 1.0"},
      {:gettext, "~> 1.0"},
      {:jason, "~> 1.2"},
      {:dns_cluster, "~> 0.2.0"},

      # --- Quality -----------------------------------------------------------
      {:ex_machina, "~> 2.8", only: :test},
      {:faker, "~> 0.18", only: :test},
      {:credo, "~> 1.7", only: [:dev, :test], runtime: false},
      {:dialyxir, "~> 1.4", only: [:dev, :test], runtime: false},
      {:sobelow, "~> 0.14", only: [:dev, :test], runtime: false}
    ]
  end

  defp releases do
    [
      backend: [
        include_executables_for: [:unix],
        applications: [runtime_tools: :permanent]
      ]
    ]
  end

  # Aliases are shortcuts or tasks specific to the current project.
  #
  # This is an API-only application: there is no asset pipeline.
  defp aliases do
    [
      setup: ["deps.get", "ecto.setup"],
      "ecto.setup": ["ecto.create", "ecto.migrate", "run priv/repo/seeds.exs"],
      "ecto.reset": ["ecto.drop", "ecto.setup"],
      test: ["ecto.create --quiet", "ecto.migrate --quiet", "test"],
      precommit: [
        "compile --warnings-as-errors",
        "deps.unlock --unused",
        "format",
        "credo --strict",
        "sobelow --config",
        "test"
      ]
    ]
  end
end
