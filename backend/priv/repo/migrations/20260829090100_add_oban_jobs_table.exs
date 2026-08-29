defmodule Kaarobar.Repo.Migrations.AddObanJobsTable do
  use Ecto.Migration

  @moduledoc """
  Oban's job storage. Required before the supervisor starts a queue.
  """

  def up, do: Oban.Migrations.up()

  def down, do: Oban.Migrations.down(version: 1)
end
