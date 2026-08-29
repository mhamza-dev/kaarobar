defmodule Kaarobar.Release do
  @moduledoc """
  Release tasks for running migrations and seeds without Mix available.

  Invoked from the release scripts, e.g. `bin/migrate`, or directly:

      bin/backend eval Kaarobar.Release.migrate
      bin/backend eval Kaarobar.Release.seed
  """

  @app :backend

  def migrate do
    load_app()

    for repo <- repos() do
      {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :up, all: true))
    end
  end

  def rollback(repo, version) do
    load_app()
    {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :down, to: version))
  end

  def seed do
    load_app()

    for repo <- repos() do
      {:ok, _, _} = Ecto.Migrator.with_repo(repo, fn _repo -> run_seed_file() end)
    end
  end

  defp run_seed_file do
    path = Application.app_dir(@app, "priv/repo/seeds.exs")

    if File.exists?(path) do
      Code.eval_file(path)
      :ok
    else
      :ok
    end
  end

  defp repos do
    Application.fetch_env!(@app, :ecto_repos)
  end

  defp load_app do
    Application.ensure_all_started(:ssl)
    Application.load(@app)
  end
end
