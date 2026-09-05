-- ============================================================================
-- Kaarobar licensing schema — plans, feature entitlements, seat/layout limits,
-- key generation — plus the cloud customer mirror (bottom of the file).
--
-- Run the whole file in the Supabase SQL editor. It is idempotent: safe to run
-- on a fresh project AND on top of any earlier version of this schema
-- (existing licenses are backfilled as the all-inclusive 'full' plan).
--
-- Plans (mirrored in shared/licensing/features.ts — the app gates on the
-- features array + limits, never the plan name, so tweaking a plan here needs
-- no app update):
--
--   plan      | features                                            | users | receipt layouts
--   ----------+-----------------------------------------------------+-------+----------------
--   basic     | pos, sales, products                                |   1   |  2
--   standard  | + customers (no credit), staff                      |   2   |  4
--   advanced  | + credit management                                 |   2   |  6
--   pro       | + suppliers, purchase orders                        |   3   |  9
--   full      | + happy hour pricing (everything)                   |  10   |  all
--
-- The second half of the file adds the customer sync: a `customers` table each
-- licensed device pushes its local customer book into every 15 minutes, plus
-- the `verify_license` heartbeat that lets a revoked or expired key lock a till
-- that is already running. See electron/sync/ and electron/licensing/.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

create table if not exists licenses (
  id uuid primary key default gen_random_uuid(),
  license_key text unique not null,
  issued_to text not null,
  max_devices int not null default 1,
  expires_at timestamptz,               -- null = lifetime
  status text not null default 'active' check (status in ('active','revoked','expired')),
  created_at timestamptz not null default now()
);

create table if not exists license_activations (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references licenses(id) on delete cascade,
  device_fingerprint text not null,
  activated_at timestamptz not null default now(),
  last_seen_at timestamptz,
  unique (license_id, device_fingerprint)
);

-- Plan columns. Existing rows are backfilled to 'full' with every feature and
-- the top limits, so current customers lose nothing.
alter table licenses add column if not exists plan text not null default 'full';
alter table licenses add column if not exists features text[] not null
  default array['pos','sales','products','customers','credit','suppliers','purchase_orders','staff','happy_hour'];
alter table licenses add column if not exists max_users int;
alter table licenses add column if not exists max_templates int;

alter table licenses
  drop constraint if exists licenses_plan_check;
alter table licenses
  add constraint licenses_plan_check
  check (plan in ('basic','standard','advanced','pro','full'));

-- Lock everything down. The anon key must NOT read/write these tables
-- directly — only call the RPC functions below.
alter table licenses enable row level security;
alter table license_activations enable row level security;
revoke all on table public.licenses from anon, authenticated;
revoke all on table public.license_activations from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Plan → features / limits mapping (single source of truth on the server)
-- ----------------------------------------------------------------------------

create or replace function public.plan_features(p_plan text)
returns text[]
language sql
immutable
as $$
  select case p_plan
    when 'basic'    then array['pos','sales','products']
    when 'standard' then array['pos','sales','products','customers','staff']
    when 'advanced' then array['pos','sales','products','customers','staff','credit']
    when 'pro'      then array['pos','sales','products','customers','staff','credit','suppliers','purchase_orders']
    when 'full'     then array['pos','sales','products','customers','staff','credit','suppliers','purchase_orders','happy_hour']
    else                 array['pos','sales','products','customers','staff','credit','suppliers','purchase_orders','happy_hour']
  end;
$$;

create or replace function public.plan_max_users(p_plan text)
returns int
language sql
immutable
as $$
  select case p_plan
    when 'basic'    then 1
    when 'standard' then 2
    when 'advanced' then 2
    when 'pro'      then 3
    when 'full'     then 10
    else                 10
  end;
$$;

create or replace function public.plan_max_templates(p_plan text)
returns int
language sql
immutable
as $$
  select case p_plan
    when 'basic'    then 2
    when 'standard' then 4
    when 'advanced' then 6
    when 'pro'      then 9
    when 'full'     then 999   -- all receipt layouts
    else                 999
  end;
$$;

-- Backfill legacy rows and rows created before the plan/limit columns.
update licenses
set features = public.plan_features(plan)
where features is null or array_length(features, 1) is null;
update licenses
set max_users = public.plan_max_users(plan)
where max_users is null or max_users < 1;
update licenses
set max_templates = public.plan_max_templates(plan)
where max_templates is null or max_templates < 1;

-- ----------------------------------------------------------------------------
-- Key generation + admin functions (service_role ONLY — never grant to anon)
--
-- Usage from the Supabase SQL editor / dashboard (runs as service role):
--   select public.create_license('Ali General Store', 'standard');
--   select public.create_license('Cafe Roma', 'full', 2, now() + interval '1 year');
--   select public.upgrade_license('KB-BASIC-XXXX-XXXX-XXXX', 'advanced');
--   select public.revoke_license('KB-PRO-XXXX-XXXX-XXXX');
--
-- Upgrading a customer: either upgrade_license() on their existing key (the
-- app picks the new plan up when the key is re-activated from Business
-- Settings → License & plan → Upgrade plan), or create_license() a fresh key
-- on the higher plan and have them paste it in the upgrade modal — activation
-- on the same device never consumes an extra seat. The app itself REFUSES a
-- key whose plan is lower than the currently installed one (no downgrades).
-- ----------------------------------------------------------------------------

create or replace function public.generate_license_key(p_plan text)
returns text
language plpgsql
volatile
as $$
declare
  -- Unambiguous alphabet: no I, L, O, 0, 1.
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_key text;
  v_block text;
  i int;
  j int;
begin
  loop
    v_key := 'KB-' || upper(coalesce(nullif(btrim(p_plan), ''), 'FULL'));
    for i in 1..3 loop
      v_block := '';
      for j in 1..4 loop
        v_block := v_block || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
      end loop;
      v_key := v_key || '-' || v_block;
    end loop;
    exit when not exists (select 1 from public.licenses where license_key = v_key);
  end loop;
  return v_key;
end;
$$;

create or replace function public.create_license(
  p_issued_to text,
  p_plan text default 'full',
  p_max_devices int default 1,
  p_expires_at timestamptz default null   -- null = lifetime
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text := lower(btrim(coalesce(p_plan, 'full')));
  v_key text;
  v_id uuid;
begin
  if btrim(coalesce(p_issued_to, '')) = '' then
    return jsonb_build_object('ok', false, 'error', 'issued_to_required');
  end if;
  if v_plan not in ('basic','standard','advanced','pro','full') then
    return jsonb_build_object('ok', false, 'error', 'unknown_plan');
  end if;
  if coalesce(p_max_devices, 0) < 1 then
    return jsonb_build_object('ok', false, 'error', 'max_devices_invalid');
  end if;

  v_key := public.generate_license_key(v_plan);

  insert into public.licenses (
    license_key, issued_to, max_devices, expires_at,
    plan, features, max_users, max_templates
  )
  values (
    v_key, btrim(p_issued_to), p_max_devices, p_expires_at,
    v_plan, public.plan_features(v_plan),
    public.plan_max_users(v_plan), public.plan_max_templates(v_plan)
  )
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'licenseKey', v_key,
    'plan', v_plan,
    'features', to_jsonb(public.plan_features(v_plan)),
    'maxDevices', p_max_devices,
    'maxUsers', public.plan_max_users(v_plan),
    'maxTemplates', public.plan_max_templates(v_plan),
    'expiresAt', p_expires_at
  );
end;
$$;

-- Change the plan of an existing key. The device picks the change up the next
-- time the key is activated/re-activated in the app.
create or replace function public.upgrade_license(
  p_key text,
  p_plan text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text := lower(btrim(coalesce(p_plan, '')));
  v_id uuid;
begin
  if v_plan not in ('basic','standard','advanced','pro','full') then
    return jsonb_build_object('ok', false, 'error', 'unknown_plan');
  end if;

  update public.licenses
  set plan = v_plan,
      features = public.plan_features(v_plan),
      max_users = public.plan_max_users(v_plan),
      max_templates = public.plan_max_templates(v_plan)
  where license_key = btrim(p_key)
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_key');
  end if;
  return jsonb_build_object('ok', true, 'id', v_id, 'plan', v_plan,
    'features', to_jsonb(public.plan_features(v_plan)),
    'maxUsers', public.plan_max_users(v_plan),
    'maxTemplates', public.plan_max_templates(v_plan));
end;
$$;

create or replace function public.revoke_license(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.licenses set status = 'revoked'
  where license_key = btrim(p_key)
  returning id into v_id;
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_key');
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- Admin functions are for the service role only.
revoke all on function public.generate_license_key(text) from public, anon, authenticated;
revoke all on function public.create_license(text, text, int, timestamptz) from public, anon, authenticated;
revoke all on function public.upgrade_license(text, text) from public, anon, authenticated;
revoke all on function public.revoke_license(text) from public, anon, authenticated;
grant execute on function public.create_license(text, text, int, timestamptz) to service_role;
grant execute on function public.upgrade_license(text, text) to service_role;
grant execute on function public.revoke_license(text) to service_role;

-- ----------------------------------------------------------------------------
-- Activation RPC (the only thing the app's anon key may call)
--
-- Device fingerprint notes:
--   * The app sends sha256 of the OS machine id (Windows MachineGuid / macOS
--     platform UUID / linux machine-id), with a durable file in ProgramData as
--     fallback — it SURVIVES app reinstalls and data wipes, so a reinstall
--     re-activates as the SAME device (last_seen_at refresh, no new seat).
--   * The seat limit is only enforced for genuinely new fingerprints.
--   * Activating a DIFFERENT key on the same device (plan upgrade with a new
--     key) creates one activation under the new license — also no extra seat
--     on the old one, which can then be revoked.
-- ----------------------------------------------------------------------------

create or replace function public.validate_and_activate_license(
  p_key text,
  p_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_license public.licenses%rowtype;
  v_existing_id uuid;
  v_device_count int;
  v_key text := btrim(p_key);
  v_fp text := btrim(p_fingerprint);
  v_now timestamptz := now();
begin
  if v_key = '' or v_fp = '' then
    return jsonb_build_object('ok', false, 'error', 'invalid_key');
  end if;

  select * into v_license
  from public.licenses
  where license_key = v_key;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_key');
  end if;

  if v_license.status = 'revoked' then
    return jsonb_build_object('ok', false, 'error', 'revoked');
  end if;

  if v_license.status = 'expired'
     or (v_license.expires_at is not null and v_license.expires_at < v_now) then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  if v_license.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', v_license.status);
  end if;

  -- Same device already activated → refresh last_seen_at, never apply limit.
  -- This is what makes a reinstall NOT consume a second seat.
  select id into v_existing_id
  from public.license_activations
  where license_id = v_license.id
    and device_fingerprint = v_fp;

  if found then
    update public.license_activations
    set last_seen_at = v_now
    where id = v_existing_id;

    return jsonb_build_object(
      'ok', true,
      'issuedTo', v_license.issued_to,
      'expiresAt', v_license.expires_at,
      'maxDevices', v_license.max_devices,
      'plan', v_license.plan,
      'features', to_jsonb(v_license.features),
      'maxUsers', coalesce(v_license.max_users, public.plan_max_users(v_license.plan)),
      'maxTemplates', coalesce(v_license.max_templates, public.plan_max_templates(v_license.plan))
    );
  end if;

  -- New device only: enforce seat limit.
  select count(*)::int into v_device_count
  from public.license_activations
  where license_id = v_license.id;

  if v_device_count >= v_license.max_devices then
    return jsonb_build_object('ok', false, 'error', 'device_limit_reached');
  end if;

  insert into public.license_activations (
    license_id,
    device_fingerprint,
    last_seen_at
  ) values (
    v_license.id,
    v_fp,
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'issuedTo', v_license.issued_to,
    'expiresAt', v_license.expires_at,
    'maxDevices', v_license.max_devices,
    'plan', v_license.plan,
    'features', to_jsonb(v_license.features),
    'maxUsers', coalesce(v_license.max_users, public.plan_max_users(v_license.plan)),
    'maxTemplates', coalesce(v_license.max_templates, public.plan_max_templates(v_license.plan))
  );
end;
$$;

grant execute on function public.validate_and_activate_license(text, text) to anon;

-- ============================================================================
-- Customer sync — cloud mirror of each licensed device's local customer book
--
-- The desktop app is offline-first: SQLite on the shop's own machine is the
-- source of truth and this is a copy, pushed up every 15 minutes by
-- electron/sync/customerSync.ts. Nothing here is ever pushed back down.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Rows are keyed by where they came from — (license, business, local id) —
-- never by anything generated here, so a re-push updates the row it updated
-- last time instead of duplicating it. That is what makes the sync safe to
-- retry, and what makes a device that re-sends everything after a restore land
-- on the same rows rather than doubling the customer book.
--
-- Deletes are soft. The till pushes `deleted` and this sets deleted_at, so a
-- customer removed by mistake on the counter is still recoverable up here.
-- ----------------------------------------------------------------------------

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references licenses(id) on delete cascade,
  -- Identifiers as they exist in the shop's SQLite file.
  business_id text not null,
  local_id text not null,
  -- Denormalized so this table is readable on its own, without a second sync
  -- for businesses.
  business_name text,
  name text not null,
  phone text,
  address text,
  opening_balance numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0,
  is_active boolean not null default true,
  local_created_at timestamptz,
  local_updated_at timestamptz,
  deleted_at timestamptz,
  -- Which device sent this version of the row. Two devices on one license each
  -- keep their own SQLite, so this is how you tell their books apart.
  device_fingerprint text,
  first_synced_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  unique (license_id, business_id, local_id)
);

create index if not exists idx_customers_license on customers(license_id);
create index if not exists idx_customers_license_business on customers(license_id, business_id);
create index if not exists idx_customers_phone on customers(license_id, phone);
create index if not exists idx_customers_live on customers(license_id, is_active)
  where deleted_at is null;

-- Same lockdown as the licensing tables: the anon key gets the RPCs and nothing
-- else. Without this, anyone holding the anon key — which ships inside the
-- app — could read every shop's customer list.
alter table customers enable row level security;
revoke all on table public.customers from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Shared license check for the RPCs below.
--
-- Deliberately NOT validate_and_activate_license: that one inserts an
-- activation row when it does not recognise the device, which would mean a
-- background job silently burning a device seat every 15 minutes. This only
-- reads.
-- ----------------------------------------------------------------------------

create or replace function public.license_check(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_license public.licenses%rowtype;
begin
  if btrim(coalesce(p_key, '')) = '' then
    return jsonb_build_object('ok', false, 'error', 'invalid_key');
  end if;

  select * into v_license
  from public.licenses
  where license_key = btrim(p_key);

  -- No row at all: the key was deleted, mistyped, or never existed. The app
  -- treats this exactly like a revocation and locks the till.
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_key');
  end if;

  if v_license.status = 'revoked' then
    return jsonb_build_object('ok', false, 'error', 'revoked');
  end if;

  if v_license.status = 'expired'
     or (v_license.expires_at is not null and v_license.expires_at < now()) then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  if v_license.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', v_license.status);
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_license.id,
    'issuedTo', v_license.issued_to,
    'expiresAt', v_license.expires_at,
    'maxDevices', v_license.max_devices,
    'plan', v_license.plan,
    'features', to_jsonb(v_license.features),
    'maxUsers', coalesce(v_license.max_users, public.plan_max_users(v_license.plan)),
    'maxTemplates', coalesce(v_license.max_templates, public.plan_max_templates(v_license.plan))
  );
end;
$fn$;

-- ----------------------------------------------------------------------------
-- Heartbeat the app calls every 15 minutes.
--
-- Answers one question: may this key still run? A definitive no — invalid_key,
-- revoked, expired — locks the till on the next tick. Anything else (no
-- internet, Supabase down) is not an answer at all, and the app keeps running
-- on its last known good check; see electron/licensing/remoteVerify.ts.
--
-- It also returns the current plan, so a plan changed with upgrade_license()
-- reaches the device within 15 minutes without anyone re-pasting a key.
--
-- Device seats are NOT enforced here. An activation row that has gone missing
-- (support cleanup, a restored backup) is a data question, not a revocation,
-- and must not brick a shop mid-sale. `deviceKnown` reports it instead.
-- ----------------------------------------------------------------------------

create or replace function public.verify_license(
  p_key text,
  p_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_check jsonb := public.license_check(p_key);
  v_license_id uuid;
  v_fp text := btrim(coalesce(p_fingerprint, ''));
  v_known boolean := false;
begin
  if not (v_check->>'ok')::boolean then
    return v_check;
  end if;

  v_license_id := (v_check->>'id')::uuid;

  if v_fp <> '' then
    update public.license_activations
    set last_seen_at = now()
    where license_id = v_license_id
      and device_fingerprint = v_fp;
    v_known := found;
  end if;

  return v_check || jsonb_build_object('deviceKnown', v_known);
end;
$fn$;

-- ----------------------------------------------------------------------------
-- Customer push.
--
-- Two arrays, because an edit and a delete are not the same operation:
--
--   p_customers — rows to write, snake_case keys, upserted. Sending the same
--                 row twice is a no-op, which is what makes the sync safe to
--                 retry after a dropped connection.
--   p_deleted   — {business_id, local_id} pairs only. These flip deleted_at on
--                 a row that is already here and touch nothing else, so the
--                 last known name and balance of a customer deleted at the
--                 counter survive up here where they can still be read.
--
-- At most 500 rows per array — the app batches. Each array is one statement, so
-- a failure leaves nothing half-written and the app retries that batch on the
-- next tick.
--
-- Row shape for p_customers:
--   { "local_id": "...", "business_id": "...", "business_name": "...",
--     "name": "...", "phone": null, "address": null,
--     "opening_balance": 0, "current_balance": 0, "is_active": true,
--     "created_at": "2026-01-01T00:00:00.000Z",
--     "updated_at": "2026-01-01T00:00:00.000Z" }
-- ----------------------------------------------------------------------------

-- Idempotency guard: an earlier draft of this file shipped a 3-argument
-- version. `create or replace` would leave that one behind as an overload,
-- and PostgREST would then have to guess which the app meant.
drop function if exists public.sync_customers(text, text, jsonb);

create or replace function public.sync_customers(
  p_key text,
  p_fingerprint text,
  p_customers jsonb default '[]'::jsonb,
  p_deleted jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_check jsonb := public.license_check(p_key);
  v_license_id uuid;
  v_fp text := nullif(btrim(coalesce(p_fingerprint, '')), '');
  v_now timestamptz := now();
  v_written int := 0;
  v_removed int := 0;
begin
  -- A device whose license no longer runs does not get to keep writing.
  if not (v_check->>'ok')::boolean then
    return v_check;
  end if;
  v_license_id := (v_check->>'id')::uuid;

  if jsonb_typeof(coalesce(p_customers, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_deleted, '[]'::jsonb)) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'invalid_payload');
  end if;
  if jsonb_array_length(coalesce(p_customers, '[]'::jsonb)) > 500
     or jsonb_array_length(coalesce(p_deleted, '[]'::jsonb)) > 500 then
    return jsonb_build_object('ok', false, 'error', 'batch_too_large');
  end if;

  if jsonb_array_length(coalesce(p_customers, '[]'::jsonb)) > 0 then
    insert into public.customers as t (
      license_id, business_id, local_id, business_name,
      name, phone, address,
      opening_balance, current_balance, is_active,
      local_created_at, local_updated_at,
      device_fingerprint, synced_at
    )
    select
      v_license_id,
      btrim(c.business_id),
      btrim(c.local_id),
      nullif(btrim(coalesce(c.business_name, '')), ''),
      btrim(c.name),
      nullif(btrim(coalesce(c.phone, '')), ''),
      nullif(btrim(coalesce(c.address, '')), ''),
      coalesce(c.opening_balance, 0),
      coalesce(c.current_balance, 0),
      coalesce(c.is_active, true),
      c.created_at,
      c.updated_at,
      v_fp,
      v_now
    from jsonb_to_recordset(p_customers) as c(
      local_id text,
      business_id text,
      business_name text,
      name text,
      phone text,
      address text,
      opening_balance numeric,
      current_balance numeric,
      is_active boolean,
      created_at timestamptz,
      updated_at timestamptz
    )
    where btrim(coalesce(c.local_id, '')) <> ''
      and btrim(coalesce(c.business_id, '')) <> ''
      and btrim(coalesce(c.name, '')) <> ''
    on conflict (license_id, business_id, local_id) do update set
      business_name      = excluded.business_name,
      name               = excluded.name,
      phone              = excluded.phone,
      address            = excluded.address,
      opening_balance    = excluded.opening_balance,
      current_balance    = excluded.current_balance,
      is_active          = excluded.is_active,
      local_created_at   = coalesce(excluded.local_created_at, t.local_created_at),
      local_updated_at   = excluded.local_updated_at,
      -- Sending a live row again undeletes it. That is what a
      -- restore-from-backup looks like from up here, and the shop is right.
      deleted_at         = null,
      device_fingerprint = excluded.device_fingerprint,
      synced_at          = excluded.synced_at;

    get diagnostics v_written = row_count;
  end if;

  if jsonb_array_length(coalesce(p_deleted, '[]'::jsonb)) > 0 then
    update public.customers t
    set
      -- coalesce, so a retried batch keeps the moment it was first deleted.
      deleted_at = coalesce(t.deleted_at, v_now),
      device_fingerprint = coalesce(v_fp, t.device_fingerprint),
      synced_at = v_now
    from jsonb_to_recordset(p_deleted) as d(local_id text, business_id text)
    where t.license_id = v_license_id
      and t.business_id = btrim(d.business_id)
      and t.local_id = btrim(d.local_id);

    get diagnostics v_removed = row_count;
  end if;

  return jsonb_build_object('ok', true, 'written', v_written, 'removed', v_removed);
end;
$fn$;

-- The app's anon key may call these two and nothing else, same as activation.
-- license_check stays internal: it is a building block, not an endpoint.
revoke all on function public.license_check(text) from public, anon, authenticated;
revoke all on function public.verify_license(text, text) from public, anon, authenticated;
revoke all on function public.sync_customers(text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.verify_license(text, text) to anon;
grant execute on function public.sync_customers(text, text, jsonb, jsonb) to anon;

-- ----------------------------------------------------------------------------
-- Reading the synced books (service role / SQL editor).
--
--   select * from customer_directory where issued_to = 'Saleem Zarai Corporation';
--
--   select issued_to, business_name, count(*) as customers,
--          sum(current_balance) filter (where current_balance > 0) as receivable
--   from customer_directory
--   group by 1, 2
--   order by receivable desc nulls last;
-- ----------------------------------------------------------------------------

create or replace view public.customer_directory as
  select
    l.license_key,
    l.issued_to,
    l.plan,
    c.business_id,
    c.business_name,
    c.local_id,
    c.name,
    c.phone,
    c.address,
    c.opening_balance,
    c.current_balance,
    c.is_active,
    c.local_created_at,
    c.local_updated_at,
    c.device_fingerprint,
    c.synced_at
  from public.customers c
  join public.licenses l on l.id = c.license_id
  where c.deleted_at is null;

revoke all on public.customer_directory from anon, authenticated;
