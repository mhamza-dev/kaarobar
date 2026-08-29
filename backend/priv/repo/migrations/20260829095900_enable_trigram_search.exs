defmodule Kaarobar.Repo.Migrations.EnableTrigramSearch do
  use Ecto.Migration

  @moduledoc """
  Trigram indexing, for catalog search.

  A cashier types three or four letters and expects the product. `LIKE '%pep%'`
  cannot use a b-tree, so on a catalog of any size it becomes a sequential scan
  at the counter, with a customer waiting. `pg_trgm` makes that prefix-free
  substring match an index lookup.

  Separate from the initial extensions migration because that one has already
  run; extensions are cheap and idempotent, so a second migration is cleaner
  than editing history.
  """

  def up do
    execute "CREATE EXTENSION IF NOT EXISTS pg_trgm"
  end

  def down do
    execute "DROP EXTENSION IF EXISTS pg_trgm"
  end
end
