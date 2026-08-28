-- ============================================================================
-- Kaarobar licensing schema — plans, feature entitlements, seat/layout limits,
-- key generation.
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
