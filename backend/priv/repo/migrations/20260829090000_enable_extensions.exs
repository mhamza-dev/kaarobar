defmodule Kaarobar.Repo.Migrations.EnableExtensions do
  use Ecto.Migration

  @moduledoc """
  Postgres extensions the schema depends on.

  `citext` gives case-insensitive uniqueness for emails and slugs at the
  database level. Doing it in the application instead — downcasing before every
  write — fails the moment one code path forgets, and by then there are two
  accounts for the same person.

  `pgcrypto` supplies `gen_random_uuid()`, used as a database-side default so
  rows inserted by a migration or a manual `INSERT` still get valid ids.
  """

  def up do
    execute "CREATE EXTENSION IF NOT EXISTS citext"
    execute "CREATE EXTENSION IF NOT EXISTS pgcrypto"
  end

  def down do
    execute "DROP EXTENSION IF EXISTS pgcrypto"
    execute "DROP EXTENSION IF EXISTS citext"
  end
end
