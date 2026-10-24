defmodule Kaarobar.Repo.Migrations.ProvisionDefaultRegisters do
  use Ecto.Migration

  @moduledoc """
  Gives every business that has no till a "Front counter" at its main branch.

  New businesses are provisioned with one (`Kaarobar.Tenancy`), but those
  created before that could not take a single sale until somebody found the
  register settings — checkout refuses to open without a register and a shift
  on it. This brings them level.

  Runs as `backend_system` for the length of the migration's transaction:
  `businesses`, `branches` and `registers` all `FORCE ROW LEVEL SECURITY`, and
  outside a superuser connection a migration has no `app.current_org_id` to
  see any of them by. Ids are UUIDv7, as `Kaarobar.Schema` generates them, so
  the cursor pagination that pages on `id` keeps its order.

  `down` leaves the registers in place: by the time anyone rolls back, sales
  may have been rung on them, and deleting a till with takings is not a
  schema change.
  """

  def up do
    execute "SET LOCAL ROLE backend_system"

    execute """
    INSERT INTO registers (
      id, organization_id, business_id, branch_id, name,
      is_active, receipt_settings, settings, inserted_at, updated_at
    )
    SELECT
      encode(
        set_bit(
          set_bit(
            overlay(
              uuid_send(gen_random_uuid())
              PLACING substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
              FROM 1 FOR 6
            ),
            52, 1
          ),
          53, 1
        ),
        'hex'
      )::uuid,
      business.organization_id,
      business.id,
      branch.id,
      'Front counter',
      true,
      '{}',
      '{}',
      timezone('utc', now()),
      timezone('utc', now())
    FROM businesses AS business
    JOIN LATERAL (
      SELECT candidate.id
      FROM branches AS candidate
      WHERE candidate.business_id = business.id AND candidate.deleted_at IS NULL
      ORDER BY candidate.is_main DESC, candidate.inserted_at ASC
      LIMIT 1
    ) AS branch ON true
    WHERE business.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM registers AS existing
        WHERE existing.business_id = business.id AND existing.deleted_at IS NULL
      )
    """

    execute "RESET ROLE"
  end

  def down, do: :ok
end
