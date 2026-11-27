-- ==============================================================================
-- Lumina Tabula — Complete Master Supabase Schema (Idempotent)
-- ------------------------------------------------------------------------------
-- Single-source-of-truth SQL covering EVERY table, column, enum, constraint,
-- view, storage bucket, trigger, RLS policy, index, and RPC function in the
-- project. Safe to run on both a fresh or existing Supabase database via:
--   Supabase Dashboard -> SQL Editor -> Paste & Run
-- ==============================================================================


-- ==============================================================================
-- 1. Extensions
-- ==============================================================================
create extension if not exists pg_trgm;


-- ==============================================================================
-- 2. Enums
-- ==============================================================================
do $$
begin
  create type public.pricing_tier as enum ('free', 'pro', 'enterprise');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.subscription_status as enum (
    'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.app_role as enum ('user', 'admin');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.post_status as enum ('draft', 'published', 'archived');
exception
  when duplicate_object then null;
end $$;


-- ==============================================================================
-- 3. Remove Legacy API Key Tables (DEEPSEEK_API_KEY lives in Edge Secrets only)
-- ==============================================================================
drop table if exists public.user_api_keys cascade;
drop table if exists public.user_api_key cascade;


-- ==============================================================================
-- 4. Shared Trigger Helper
-- ==============================================================================
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;


-- ==============================================================================
-- 5. Profiles (1 row per auth.users account)
-- ==============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  tier public.pricing_tier not null default 'free',
  role public.app_role not null default 'user',
  last_sign_in_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Ensure upgrade columns exist on existing databases
alter table public.profiles
  add column if not exists role public.app_role not null default 'user';
alter table public.profiles
  add column if not exists last_sign_in_at timestamptz;
alter table public.profiles
  add column if not exists is_suspended boolean not null default false;
alter table public.profiles
  add column if not exists suspended_reason text;
alter table public.profiles
  add column if not exists suspended_at timestamptz;

update public.profiles set role = 'user' where role is null;

alter table public.profiles enable row level security;

-- Lock column-level update grants so clients can never tamper with role or tier
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();


-- ==============================================================================
-- 6. Admin Role Helper & Anti-Escalation / Anti-Self-Demotion Guards
-- ==============================================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and coalesce(p.is_suspended, false) = false
  );
$$;

comment on function public.is_admin() is
  'True when the current auth.uid() belongs to a profile with role = admin.';

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null then
    if new.role is distinct from old.role then
      if not public.is_admin() then
        raise exception 'Only administrators can change an account role.'
          using errcode = '42501';
      end if;
      if old.id = auth.uid() and old.role = 'admin' then
        raise exception 'Administrators cannot demote their own account.'
          using errcode = '42501';
      end if;
    end if;

    if new.tier is distinct from old.tier and not public.is_admin() then
      raise exception 'Subscription tier can only be updated by an administrator or billing.'
        using errcode = '42501';
    end if;

    if new.is_suspended is distinct from old.is_suspended then
      if not public.is_admin() then
        raise exception 'Only administrators can suspend or unsuspend an account.'
          using errcode = '42501';
      end if;
      if old.id = auth.uid() or old.role = 'admin' then
        raise exception 'Administrator accounts cannot be suspended.'
          using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_role on public.profiles;
create trigger guard_profile_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- Profile RLS policies
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can update own display profile" on public.profiles;
create policy "Users can update own display profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());


-- ==============================================================================
-- 7. Subscriptions (7-day free trial on signup, Stripe-managed thereafter)
-- ==============================================================================
create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  tier public.pricing_tier not null default 'free',
  status public.subscription_status not null default 'trialing',
  price_id text,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.subscriptions
  add column if not exists trial_ends_at timestamptz;

-- Backfill any legacy free rows missing trial_ends_at
update public.subscriptions
   set status = 'trialing',
       current_period_start = coalesce(current_period_start, created_at),
       trial_ends_at = coalesce(trial_ends_at, created_at + interval '7 days'),
       current_period_end = coalesce(current_period_end, created_at + interval '7 days')
 where tier = 'free'
   and stripe_subscription_id is null
   and trial_ends_at is null;

alter table public.subscriptions enable row level security;

drop policy if exists "Users can view own subscription" on public.subscriptions;
create policy "Users can view own subscription"
  on public.subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Admins can read all subscriptions" on public.subscriptions;
create policy "Admins can read all subscriptions"
  on public.subscriptions
  for select
  to authenticated
  using (public.is_admin());

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute procedure public.handle_updated_at();

create index if not exists idx_subscriptions_user_id
  on public.subscriptions (user_id);


-- ==============================================================================
-- 8. Usage Ledger (per-query token metering)
-- ==============================================================================
create table if not exists public.usage_ledger (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  query_count int not null default 1,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  model text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.usage_ledger enable row level security;

drop policy if exists "Users can view own usage" on public.usage_ledger;
create policy "Users can view own usage"
  on public.usage_ledger
  for select
  to authenticated
  using (auth.uid() = user_id);

create index if not exists idx_usage_user_id
  on public.usage_ledger (user_id);
create index if not exists idx_usage_created_at
  on public.usage_ledger (created_at desc);

create or replace function public.get_monthly_token_usage(
  p_user_id uuid,
  p_since timestamptz
)
returns table (
  input_tokens bigint,
  output_tokens bigint,
  total_tokens bigint,
  query_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(u.input_tokens), 0)::bigint as input_tokens,
    coalesce(sum(u.output_tokens), 0)::bigint as output_tokens,
    coalesce(sum(u.input_tokens + u.output_tokens), 0)::bigint as total_tokens,
    coalesce(sum(u.query_count), 0)::bigint as query_count
  from public.usage_ledger u
  where u.user_id = p_user_id
    and u.created_at >= p_since;
$$;

revoke all on function public.get_monthly_token_usage(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.get_monthly_token_usage(uuid, timestamptz) to service_role;


-- ==============================================================================
-- 9. User Balances (per-account live token balance — service_role writes only)
-- ==============================================================================
create table if not exists public.user_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tokens_remaining integer not null default 250000 check (tokens_remaining >= 0),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.user_balances is
  'Per-user remaining token balance. Users may SELECT their own row; only service_role may UPDATE.';

alter table public.user_balances enable row level security;

revoke all on table public.user_balances from public, anon, authenticated;
grant select on table public.user_balances to authenticated;
grant all on table public.user_balances to service_role;

drop policy if exists "Users read own balance" on public.user_balances;
create policy "Users read own balance"
  on public.user_balances
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Admins can read all balances" on public.user_balances;
create policy "Admins can read all balances"
  on public.user_balances
  for select
  to authenticated
  using (public.is_admin());

drop trigger if exists set_user_balances_updated_at on public.user_balances;
create trigger set_user_balances_updated_at
  before update on public.user_balances
  for each row execute procedure public.handle_updated_at();

-- Backfill balances for any existing auth.users rows
insert into public.user_balances (user_id, tokens_remaining)
select id, 250000
from auth.users
on conflict (user_id) do nothing;

-- Atomic token deduction RPC (called by deepseek-proxy Edge Function via service_role)
create or replace function public.deduct_user_tokens(
  p_user_id uuid,
  p_tokens integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining integer;
  v_deduct integer := greatest(0, coalesce(p_tokens, 0));
begin
  insert into public.user_balances (user_id, tokens_remaining)
  values (p_user_id, 250000)
  on conflict (user_id) do nothing;

  update public.user_balances
     set tokens_remaining = greatest(0, tokens_remaining - v_deduct),
         updated_at = timezone('utc'::text, now())
   where user_id = p_user_id
  returning tokens_remaining into v_remaining;

  return coalesce(v_remaining, 0);
end;
$$;

revoke all on function public.deduct_user_tokens(uuid, integer) from public, anon, authenticated;
grant execute on function public.deduct_user_tokens(uuid, integer) to service_role;


-- ==============================================================================
-- 10. No-Login Guest Trial Balances & Salted IP-Hash Daily Limits
--     Accessed strictly via service_role inside deepseek-proxy Edge Function.
-- ==============================================================================
create table if not exists public.guest_balances (
  guest_id uuid primary key,
  tokens_remaining integer not null default 20000 check (tokens_remaining >= 0),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.guest_balances enable row level security;
revoke all on table public.guest_balances from public, anon, authenticated;
grant all on table public.guest_balances to service_role;

create table if not exists public.guest_ip_limits (
  ip_hash text primary key,
  tokens_remaining integer not null default 25000 check (tokens_remaining >= 0),
  window_started_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.guest_ip_limits enable row level security;
revoke all on table public.guest_ip_limits from public, anon, authenticated;
grant all on table public.guest_ip_limits to service_role;


-- ==============================================================================
-- 10b. Admin Email Pro Grants & Security Audit Logs
-- ==============================================================================
create table if not exists public.admin_email_grants (
  email text primary key,
  tier public.pricing_tier not null default 'pro',
  duration_days int not null default 30 check (duration_days between 1 and 3650),
  tokens_granted int not null default 5000000 check (tokens_granted >= 0),
  note text,
  granted_by uuid references public.profiles(id) on delete set null,
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.admin_email_grants enable row level security;
revoke all on table public.admin_email_grants from public, anon, authenticated;
grant select on table public.admin_email_grants to authenticated;
grant all on table public.admin_email_grants to service_role;

drop policy if exists "Admins can view email grants" on public.admin_email_grants;
create policy "Admins can view email grants"
  on public.admin_email_grants
  for select
  to authenticated
  using (public.is_admin());

create table if not exists public.admin_audit_logs (
  id bigserial primary key,
  admin_id uuid references public.profiles(id) on delete set null,
  admin_email text,
  action text not null,
  target_user_id uuid,
  target_email text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.admin_audit_logs enable row level security;
revoke all on table public.admin_audit_logs from public, anon, authenticated;
grant select on table public.admin_audit_logs to authenticated;
grant all on table public.admin_audit_logs to service_role;

drop policy if exists "Admins can view audit logs" on public.admin_audit_logs;
create policy "Admins can view audit logs"
  on public.admin_audit_logs
  for select
  to authenticated
  using (public.is_admin());

create index if not exists idx_admin_audit_logs_created_at
  on public.admin_audit_logs (created_at desc);


-- ==============================================================================
-- 11. Auth Triggers (New Signup + Pre-Approved Email Pro Grant + Last Sign-In)
-- ==============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc'::text, now());
  v_trial_end timestamptz := timezone('utc'::text, now()) + interval '7 days';
  v_is_anon boolean := coalesce(new.is_anonymous, false);
  v_email text := lower(trim(coalesce(new.email, 'guest-' || left(new.id::text, 8) || '@guest.local')));
  v_name text := case
    when v_is_anon then 'Guest'
    else coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(v_email, '@', 1)
    )
  end;
  v_grant record;
  v_tier public.pricing_tier := 'free';
  v_status public.subscription_status := 'trialing';
  v_period_end timestamptz := v_trial_end;
  v_initial_tokens int := case when v_is_anon then 20000 else 250000 end;
begin
  if not v_is_anon then
    select *
      into v_grant
      from public.admin_email_grants g
     where g.email = v_email
       and g.expires_at > v_now;

    if found then
      v_tier := v_grant.tier;
      v_status := 'active';
      v_period_end := greatest(v_grant.expires_at, v_now + (v_grant.duration_days || ' days')::interval);
      v_initial_tokens := v_grant.tokens_granted;
    end if;
  end if;

  insert into public.profiles (id, email, display_name, avatar_url, tier)
  values (
    new.id,
    v_email,
    v_name,
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    v_tier
  )
  on conflict (id) do update
    set tier = excluded.tier;

  if not exists (select 1 from public.subscriptions where user_id = new.id) then
    insert into public.subscriptions (
      user_id,
      tier,
      status,
      trial_ends_at,
      current_period_start,
      current_period_end,
      cancel_at_period_end
    )
    values (
      new.id,
      v_tier,
      v_status,
      v_period_end,
      v_now,
      v_period_end,
      false
    );
  end if;

  insert into public.user_balances (user_id, tokens_remaining)
  values (new.id, v_initial_tokens)
  on conflict (user_id) do update
    set tokens_remaining = greatest(public.user_balances.tokens_remaining, excluded.tokens_remaining);

  if not v_is_anon and v_grant is not null and v_grant.email is not null then
    update public.admin_email_grants
       set claimed_by = new.id,
           claimed_at = v_now,
           updated_at = v_now
     where email = v_email;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_sign_in()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    update public.profiles
       set last_sign_in_at = new.last_sign_in_at
     where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_signed_in on auth.users;
create trigger on_auth_user_signed_in
  after update on auth.users
  for each row execute function public.handle_user_sign_in();


-- ==============================================================================
-- 12. Self-Service Account Deletion & Optional Exit Feedback (Admin-Protected)
-- ==============================================================================
create table if not exists public.account_deletions (
  id bigserial primary key,
  user_id uuid,
  email text,
  display_name text,
  tier text,
  reason text,
  note text,
  deleted_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.account_deletions enable row level security;
revoke all on table public.account_deletions from public, anon, authenticated;
grant select on table public.account_deletions to authenticated;
grant all on table public.account_deletions to service_role;

drop policy if exists "Admins can view account deletions" on public.account_deletions;
create policy "Admins can view account deletions"
  on public.account_deletions
  for select
  to authenticated
  using (public.is_admin());

drop function if exists public.delete_my_account();
create or replace function public.delete_my_account(
  p_reason text default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_profile record;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select id, email, display_name, tier::text as tier, role::text as role
  into v_profile
  from public.profiles
  where id = v_uid;

  if v_profile.role = 'admin' then
    raise exception 'Administrator accounts cannot be self-deleted.'
      using errcode = '42501';
  end if;

  insert into public.account_deletions (user_id, email, display_name, tier, reason, note)
  values (
    v_uid,
    v_profile.email,
    v_profile.display_name,
    v_profile.tier,
    nullif(left(trim(coalesce(p_reason, '')), 120), ''),
    nullif(left(trim(coalesce(p_note, '')), 500), '')
  );

  if to_regclass('public.posts') is not null then
    delete from public.posts where author_id = v_uid;
  end if;

  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account(text, text) from public, anon;
grant execute on function public.delete_my_account(text, text) to authenticated;


-- ==============================================================================
-- 12b. Admin RPCs: Grant Pro by Email (1 Month), Member Control & Security Audit
-- ==============================================================================
create or replace function public.admin_grant_pro_by_email(
  p_email text,
  p_tier public.pricing_tier default 'pro',
  p_days int default 30,
  p_tokens int default 5000000,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_admin_email text;
  v_clean_email text := lower(trim(coalesce(p_email, '')));
  v_days int := greatest(1, least(coalesce(p_days, 30), 3650));
  v_tokens int := greatest(0, least(coalesce(p_tokens, 5000000), 100000000));
  v_tier public.pricing_tier := coalesce(p_tier, 'pro');
  v_note text := nullif(left(trim(coalesce(p_note, '')), 280), '');
  v_now timestamptz := timezone('utc'::text, now());
  v_expires_at timestamptz := timezone('utc'::text, now()) + (v_days || ' days')::interval;
  v_target_profile record;
  v_applied boolean := false;
begin
  if v_admin_id is null or not public.is_admin() then
    raise exception 'Forbidden: administrator privileges required.'
      using errcode = '42501';
  end if;

  if v_clean_email = '' or v_clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please provide a valid email address.'
      using errcode = '22023';
  end if;

  select email into v_admin_email from public.profiles where id = v_admin_id;

  select id, email, display_name, role
    into v_target_profile
    from public.profiles
   where lower(trim(email)) = v_clean_email
   order by created_at desc
   limit 1;

  if found then
    v_applied := true;

    update public.profiles
       set tier = v_tier,
           is_suspended = false,
           suspended_reason = null,
           suspended_at = null,
           updated_at = v_now
     where id = v_target_profile.id;

    if exists (select 1 from public.subscriptions where user_id = v_target_profile.id) then
      update public.subscriptions
         set tier = v_tier,
             status = 'active',
             current_period_start = v_now,
             current_period_end = v_expires_at,
             trial_ends_at = v_expires_at,
             cancel_at_period_end = false,
             updated_at = v_now
       where user_id = v_target_profile.id;
    else
      insert into public.subscriptions (
        user_id, tier, status, trial_ends_at, current_period_start, current_period_end, cancel_at_period_end
      )
      values (
        v_target_profile.id, v_tier, 'active', v_expires_at, v_now, v_expires_at, false
      );
    end if;

    insert into public.user_balances (user_id, tokens_remaining, updated_at)
    values (v_target_profile.id, v_tokens, v_now)
    on conflict (user_id) do update
      set tokens_remaining = excluded.tokens_remaining,
          updated_at = v_now;
  end if;

  insert into public.admin_email_grants (
    email, tier, duration_days, tokens_granted, note,
    granted_by, claimed_by, claimed_at, expires_at, created_at, updated_at
  )
  values (
    v_clean_email,
    v_tier,
    v_days,
    v_tokens,
    v_note,
    v_admin_id,
    case when v_applied then v_target_profile.id else null end,
    case when v_applied then v_now else null end,
    v_expires_at,
    v_now,
    v_now
  )
  on conflict (email) do update
    set tier = excluded.tier,
        duration_days = excluded.duration_days,
        tokens_granted = excluded.tokens_granted,
        note = excluded.note,
        granted_by = excluded.granted_by,
        claimed_by = coalesce(excluded.claimed_by, public.admin_email_grants.claimed_by),
        claimed_at = coalesce(excluded.claimed_at, public.admin_email_grants.claimed_at),
        expires_at = excluded.expires_at,
        updated_at = v_now;

  insert into public.admin_audit_logs (
    admin_id, admin_email, action, target_user_id, target_email, details
  )
  values (
    v_admin_id,
    v_admin_email,
    case when v_applied then 'grant_pro_existing' else 'grant_pro_preapproved' end,
    case when v_applied then v_target_profile.id else null end,
    v_clean_email,
    jsonb_build_object(
      'tier', v_tier,
      'duration_days', v_days,
      'tokens_granted', v_tokens,
      'expires_at', v_expires_at,
      'note', v_note
    )
  );

  return jsonb_build_object(
    'status', case when v_applied then 'applied' else 'pre_approved' end,
    'email', v_clean_email,
    'user_id', case when v_applied then v_target_profile.id else null end,
    'tier', v_tier,
    'duration_days', v_days,
    'tokens_remaining', v_tokens,
    'expires_at', v_expires_at
  );
end;
$$;

revoke all on function public.admin_grant_pro_by_email(text, public.pricing_tier, int, int, text) from public, anon;
grant execute on function public.admin_grant_pro_by_email(text, public.pricing_tier, int, int, text) to authenticated;

create or replace function public.admin_revoke_email_grant(
  p_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_admin_email text;
  v_clean_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_admin_id is null or not public.is_admin() then
    raise exception 'Forbidden: administrator privileges required.'
      using errcode = '42501';
  end if;

  select email into v_admin_email from public.profiles where id = v_admin_id;

  delete from public.admin_email_grants where email = v_clean_email;

  insert into public.admin_audit_logs (
    admin_id, admin_email, action, target_email, details
  )
  values (
    v_admin_id,
    v_admin_email,
    'revoke_email_grant',
    v_clean_email,
    jsonb_build_object('email', v_clean_email)
  );
end;
$$;

revoke all on function public.admin_revoke_email_grant(text) from public, anon;
grant execute on function public.admin_revoke_email_grant(text) to authenticated;

create or replace function public.admin_manage_member(
  p_target_user_id uuid,
  p_action text,
  p_tier public.pricing_tier default null,
  p_days int default 30,
  p_tokens int default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_admin_id uuid := auth.uid();
  v_admin_email text;
  v_target record;
  v_sub record;
  v_now timestamptz := timezone('utc'::text, now());
  v_days int := greatest(1, least(coalesce(p_days, 30), 3650));
  v_expires_at timestamptz;
  v_tokens int;
  v_clean_reason text := nullif(left(trim(coalesce(p_reason, '')), 280), '');
begin
  if v_admin_id is null or not public.is_admin() then
    raise exception 'Forbidden: administrator privileges required.'
      using errcode = '42501';
  end if;

  if p_target_user_id is null then
    raise exception 'Target member ID is required.'
      using errcode = '22023';
  end if;

  select email into v_admin_email from public.profiles where id = v_admin_id;

  select id, email, display_name, tier, role, is_suspended
    into v_target
    from public.profiles
   where id = p_target_user_id;

  if not found then
    raise exception 'Member not found.'
      using errcode = 'P0002';
  end if;

  select *
    into v_sub
    from public.subscriptions
   where user_id = p_target_user_id
   order by created_at desc
   limit 1;

  if p_action = 'grant_pro_month' or p_action = 'grant_enterprise_month' then
    declare
      v_new_tier public.pricing_tier := case
        when p_action = 'grant_enterprise_month' then 'enterprise'::public.pricing_tier
        else coalesce(p_tier, 'pro'::public.pricing_tier)
      end;
      v_default_tokens int := case
        when v_new_tier = 'enterprise' then 25000000
        else 5000000
      end;
    begin
      v_expires_at := v_now + (v_days || ' days')::interval;
      v_tokens := greatest(0, least(coalesce(p_tokens, v_default_tokens), 100000000));

      update public.profiles
         set tier = v_new_tier,
             is_suspended = false,
             suspended_reason = null,
             suspended_at = null,
             updated_at = v_now
       where id = p_target_user_id;

      if v_sub.id is not null then
        update public.subscriptions
           set tier = v_new_tier,
               status = 'active',
               current_period_start = v_now,
               current_period_end = v_expires_at,
               trial_ends_at = v_expires_at,
               cancel_at_period_end = false,
               updated_at = v_now
         where id = v_sub.id;
      else
        insert into public.subscriptions (
          user_id, tier, status, trial_ends_at, current_period_start, current_period_end, cancel_at_period_end
        )
        values (
          p_target_user_id, v_new_tier, 'active', v_expires_at, v_now, v_expires_at, false
        );
      end if;

      insert into public.user_balances (user_id, tokens_remaining, updated_at)
      values (p_target_user_id, v_tokens, v_now)
      on conflict (user_id) do update
        set tokens_remaining = excluded.tokens_remaining,
            updated_at = v_now;
    end;

  elsif p_action = 'extend_period' then
    declare
      v_base timestamptz := greatest(v_now, coalesce(v_sub.current_period_end, v_now));
    begin
      v_expires_at := v_base + (v_days || ' days')::interval;

      if v_sub.id is not null then
        update public.subscriptions
           set status = 'active',
               current_period_end = v_expires_at,
               trial_ends_at = v_expires_at,
               cancel_at_period_end = false,
               updated_at = v_now
         where id = v_sub.id;
      else
        insert into public.subscriptions (
          user_id, tier, status, trial_ends_at, current_period_start, current_period_end, cancel_at_period_end
        )
        values (
          p_target_user_id, v_target.tier, 'active', v_expires_at, v_now, v_expires_at, false
        );
      end if;

      if p_tokens is not null then
        v_tokens := greatest(0, least(p_tokens, 100000000));
        insert into public.user_balances (user_id, tokens_remaining, updated_at)
        values (p_target_user_id, v_tokens, v_now)
        on conflict (user_id) do update
          set tokens_remaining = excluded.tokens_remaining,
              updated_at = v_now;
      end if;
    end;

  elsif p_action = 'reset_trial' then
    v_expires_at := v_now + interval '7 days';
    v_tokens := coalesce(p_tokens, 250000);

    update public.profiles
       set tier = 'free',
           is_suspended = false,
           suspended_reason = null,
           suspended_at = null,
           updated_at = v_now
     where id = p_target_user_id;

    if v_sub.id is not null then
      update public.subscriptions
         set tier = 'free',
             status = 'trialing',
             current_period_start = v_now,
             current_period_end = v_expires_at,
             trial_ends_at = v_expires_at,
             cancel_at_period_end = false,
             updated_at = v_now
       where id = v_sub.id;
    else
      insert into public.subscriptions (
        user_id, tier, status, trial_ends_at, current_period_start, current_period_end, cancel_at_period_end
      )
      values (
        p_target_user_id, 'free', 'trialing', v_expires_at, v_now, v_expires_at, false
      );
    end if;

    insert into public.user_balances (user_id, tokens_remaining, updated_at)
    values (p_target_user_id, v_tokens, v_now)
    on conflict (user_id) do update
      set tokens_remaining = excluded.tokens_remaining,
          updated_at = v_now;

  elsif p_action = 'downgrade_free' then
    if v_target.role = 'admin' then
      raise exception 'Administrator accounts cannot be downgraded.'
        using errcode = '42501';
    end if;

    v_expires_at := v_now;
    v_tokens := coalesce(p_tokens, 250000);

    update public.profiles
       set tier = 'free',
           updated_at = v_now
     where id = p_target_user_id;

    if v_sub.id is not null then
      update public.subscriptions
         set tier = 'free',
             status = 'canceled',
             current_period_end = v_now,
             cancel_at_period_end = false,
             updated_at = v_now
       where id = v_sub.id;
    end if;

    insert into public.user_balances (user_id, tokens_remaining, updated_at)
    values (p_target_user_id, v_tokens, v_now)
    on conflict (user_id) do update
      set tokens_remaining = least(public.user_balances.tokens_remaining, excluded.tokens_remaining),
          updated_at = v_now;

  elsif p_action = 'set_tokens' then
    v_tokens := greatest(0, least(coalesce(p_tokens, 250000), 100000000));
    insert into public.user_balances (user_id, tokens_remaining, updated_at)
    values (p_target_user_id, v_tokens, v_now)
    on conflict (user_id) do update
      set tokens_remaining = excluded.tokens_remaining,
          updated_at = v_now;

  elsif p_action = 'suspend' then
    if p_target_user_id = v_admin_id or v_target.role = 'admin' then
      raise exception 'Administrator accounts cannot be suspended.'
        using errcode = '42501';
    end if;

    update public.profiles
       set is_suspended = true,
           suspended_reason = coalesce(v_clean_reason, 'Suspended by administrator'),
           suspended_at = v_now,
           updated_at = v_now
     where id = p_target_user_id;

    update auth.users
       set banned_until = v_now + interval '100 years'
     where id = p_target_user_id;

    delete from auth.sessions where user_id = p_target_user_id;

  elsif p_action = 'unsuspend' then
    update public.profiles
       set is_suspended = false,
           suspended_reason = null,
           suspended_at = null,
           updated_at = v_now
     where id = p_target_user_id;

    update auth.users
       set banned_until = null
     where id = p_target_user_id;

  elsif p_action = 'delete_user' then
    if p_target_user_id = v_admin_id or v_target.role = 'admin' then
      raise exception 'Administrator accounts cannot be deleted.'
        using errcode = '42501';
    end if;

    insert into public.account_deletions (user_id, email, display_name, tier, reason, note)
    values (
      v_target.id,
      v_target.email,
      v_target.display_name,
      v_target.tier::text,
      'Removed by administrator',
      v_clean_reason
    );

    insert into public.admin_audit_logs (
      admin_id, admin_email, action, target_user_id, target_email, details
    )
    values (
      v_admin_id,
      v_admin_email,
      'delete_user',
      v_target.id,
      v_target.email,
      jsonb_build_object('reason', v_clean_reason)
    );

    delete from auth.users where id = p_target_user_id;

    return jsonb_build_object(
      'status', 'deleted',
      'user_id', p_target_user_id,
      'email', v_target.email
    );

  else
    raise exception 'Unsupported admin action: %', p_action
      using errcode = '22023';
  end if;

  insert into public.admin_audit_logs (
    admin_id, admin_email, action, target_user_id, target_email, details
  )
  values (
    v_admin_id,
    v_admin_email,
    p_action,
    v_target.id,
    v_target.email,
    jsonb_build_object(
      'tier', coalesce(p_tier::text, v_target.tier::text),
      'days', v_days,
      'tokens', v_tokens,
      'expires_at', v_expires_at,
      'reason', v_clean_reason
    )
  );

  return jsonb_build_object(
    'status', 'ok',
    'action', p_action,
    'user_id', p_target_user_id,
    'email', v_target.email
  );
end;
$$;

revoke all on function public.admin_manage_member(uuid, text, public.pricing_tier, int, int, text) from public, anon;
grant execute on function public.admin_manage_member(uuid, text, public.pricing_tier, int, int, text) to authenticated;

notify pgrst, 'reload schema';


-- ==============================================================================
-- 13. Published Posts, Post Images, Views, Trigram Search & Media Bucket
-- ==============================================================================
create table if not exists public.posts (
  id uuid default gen_random_uuid() primary key,
  slug text not null unique,
  title text not null,
  subtitle text,
  excerpt text,
  content text not null default '',
  blocks jsonb not null default '[]'::jsonb,
  cover_image_url text,
  cover_caption text,
  source_message_id text,
  source_session_id text,
  dataset_name text,
  model text,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text,
  author_avatar_url text,
  status public.post_status not null default 'draft',
  tags text[] not null default '{}',
  featured boolean not null default false,
  reading_time_minutes int not null default 1,
  view_count bigint not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint posts_title_length check (char_length(title) between 1 and 240),
  constraint posts_published_has_date check (
    status <> 'published' or published_at is not null
  )
);

create table if not exists public.post_images (
  id uuid default gen_random_uuid() primary key,
  post_id uuid not null references public.posts(id) on delete cascade,
  url text not null,
  storage_path text,
  alt_text text,
  caption text,
  width int,
  height int,
  position int not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- RLS: posts
alter table public.posts enable row level security;
grant select on public.posts to anon, authenticated;
grant insert, update, delete on public.posts to authenticated;

drop policy if exists "Published posts are public" on public.posts;
create policy "Published posts are public"
  on public.posts
  for select
  to anon, authenticated
  using (
    status = 'published'
    and published_at is not null
    and published_at <= timezone('utc'::text, now())
  );

drop policy if exists "Admins can read every post" on public.posts;
create policy "Admins can read every post"
  on public.posts
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can publish posts" on public.posts;
create policy "Admins can publish posts"
  on public.posts
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update posts" on public.posts;
create policy "Admins can update posts"
  on public.posts
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete posts" on public.posts;
create policy "Admins can delete posts"
  on public.posts
  for delete
  to authenticated
  using (public.is_admin());

-- RLS: post_images
alter table public.post_images enable row level security;
grant select on public.post_images to anon, authenticated;
grant insert, update, delete on public.post_images to authenticated;

drop policy if exists "Images of published posts are public" on public.post_images;
create policy "Images of published posts are public"
  on public.post_images
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.posts p
      where p.id = post_images.post_id
        and p.status = 'published'
        and p.published_at is not null
        and p.published_at <= timezone('utc'::text, now())
    )
  );

drop policy if exists "Admins can read every image" on public.post_images;
create policy "Admins can read every image"
  on public.post_images
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can add images" on public.post_images;
create policy "Admins can add images"
  on public.post_images
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update images" on public.post_images;
create policy "Admins can update images"
  on public.post_images
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete images" on public.post_images;
create policy "Admins can delete images"
  on public.post_images
  for delete
  to authenticated
  using (public.is_admin());

-- Post triggers & view counter
create or replace function public.stamp_post_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.author_id := auth.uid();
    select coalesce(p.display_name, p.email), p.avatar_url
      into new.author_name, new.author_avatar_url
      from public.profiles p
     where p.id = auth.uid();
    new.author_name := coalesce(new.author_name, 'Lumina Tabula');
  end if;

  if new.status = 'published' and new.published_at is null then
    new.published_at := timezone('utc'::text, now());
  end if;

  return new;
end;
$$;

drop trigger if exists stamp_post_author on public.posts;
create trigger stamp_post_author
  before insert or update on public.posts
  for each row execute function public.stamp_post_author();

drop trigger if exists set_posts_updated_at on public.posts;
create trigger set_posts_updated_at
  before update on public.posts
  for each row execute procedure public.handle_updated_at();

create or replace function public.increment_post_view(post_slug text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count bigint;
begin
  update public.posts
     set view_count = view_count + 1
   where slug = post_slug
     and status = 'published'
  returning view_count into new_count;

  return coalesce(new_count, 0);
end;
$$;

revoke all on function public.increment_post_view(text) from public;
grant execute on function public.increment_post_view(text) to anon, authenticated;

-- Public feed view
create or replace view public.published_posts
with (security_invoker = true)
as
select
  p.id,
  p.slug,
  p.title,
  p.subtitle,
  p.excerpt,
  p.cover_image_url,
  p.cover_caption,
  p.tags,
  p.featured,
  p.reading_time_minutes,
  p.view_count,
  p.author_name,
  p.author_avatar_url,
  p.dataset_name,
  p.model,
  p.published_at,
  p.created_at,
  p.updated_at
from public.posts p
where p.status = 'published'
  and p.published_at is not null
  and p.published_at <= timezone('utc'::text, now());

grant select on public.published_posts to anon, authenticated;

-- Post indexes & trigram search
create index if not exists idx_posts_published_at
  on public.posts (published_at desc)
  where status = 'published';
create index if not exists idx_posts_status_published
  on public.posts (status, published_at desc);
create index if not exists idx_posts_author
  on public.posts (author_id);
create index if not exists idx_posts_tags
  on public.posts using gin (tags);
create index if not exists idx_posts_search
  on public.posts using gin (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(excerpt, '') || ' ' || coalesce(content, ''))
  );
create index if not exists idx_post_images_post
  on public.post_images (post_id, position);

create index if not exists posts_title_trgm_idx
  on public.posts using gin (title gin_trgm_ops);
create index if not exists posts_subtitle_trgm_idx
  on public.posts using gin (subtitle gin_trgm_ops);
create index if not exists posts_excerpt_trgm_idx
  on public.posts using gin (excerpt gin_trgm_ops);
create index if not exists posts_dataset_trgm_idx
  on public.posts using gin (dataset_name gin_trgm_ops);
create index if not exists posts_content_trgm_idx
  on public.posts using gin (content gin_trgm_ops);

create or replace function public.search_published_posts(
  p_query text default null,
  p_tag text default null,
  p_limit int default 12,
  p_offset int default 0
)
returns table (
  id uuid,
  slug text,
  title text,
  subtitle text,
  excerpt text,
  content text,
  cover_image_url text,
  cover_caption text,
  tags text[],
  featured boolean,
  reading_time_minutes int,
  view_count bigint,
  author_name text,
  author_avatar_url text,
  dataset_name text,
  model text,
  published_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  blocks jsonb,
  total_count bigint,
  rank real
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with q as (
    select nullif(trim(coalesce(p_query, '')), '') as term
  ),
  matched as (
    select
      p.id,
      p.slug,
      p.title,
      p.subtitle,
      p.excerpt,
      p.content,
      p.cover_image_url,
      p.cover_caption,
      p.tags,
      p.featured,
      p.reading_time_minutes,
      p.view_count,
      p.author_name,
      p.author_avatar_url,
      p.dataset_name,
      p.model,
      p.published_at,
      p.created_at,
      p.updated_at,
      p.blocks,
      (
        case
          when (select term from q) is null then 0::real
          else (
            greatest(
              similarity(p.title, (select term from q)) * 2.5,
              word_similarity((select term from q), p.title) * 2.2,
              similarity(coalesce(p.subtitle, ''), (select term from q)) * 1.4,
              similarity(coalesce(p.excerpt, ''), (select term from q)) * 1.2,
              similarity(coalesce(p.dataset_name, ''), (select term from q)) * 1.5,
              similarity(left(coalesce(p.content, ''), 2000), (select term from q)) * 0.6
            )
          )::real
        end
      ) as rank
    from public.posts p
    cross join q
    where p.status = 'published'
      and (p_tag is null or p.tags @> array[p_tag])
      and (
        q.term is null
        or p.title % q.term
        or q.term <% p.title
        or coalesce(p.subtitle, '') % q.term
        or coalesce(p.excerpt, '') % q.term
        or coalesce(p.dataset_name, '') % q.term
        or word_similarity(q.term, p.title) >= 0.25
        or word_similarity(q.term, coalesce(p.subtitle, '')) >= 0.25
        or word_similarity(q.term, coalesce(p.excerpt, '')) >= 0.25
        or word_similarity(q.term, left(coalesce(p.content, ''), 3000)) >= 0.3
      )
  )
  select
    m.id,
    m.slug,
    m.title,
    m.subtitle,
    m.excerpt,
    m.content,
    m.cover_image_url,
    m.cover_caption,
    m.tags,
    m.featured,
    m.reading_time_minutes,
    m.view_count,
    m.author_name,
    m.author_avatar_url,
    m.dataset_name,
    m.model,
    m.published_at,
    m.created_at,
    m.updated_at,
    m.blocks,
    count(*) over () as total_count,
    m.rank
  from matched m
  order by
    case when (select term from q) is not null then m.rank else 0 end desc,
    m.featured desc,
    m.published_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 12), 50))
  offset greatest(0, coalesce(p_offset, 0));
$$;

grant execute on function public.search_published_posts(text, text, int, int) to anon, authenticated;

-- Storage bucket: post-media (public read, admin write)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media',
  'post-media',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Post media is publicly readable" on storage.objects;
create policy "Post media is publicly readable"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'post-media');

drop policy if exists "Admins can upload post media" on storage.objects;
create policy "Admins can upload post media"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'post-media' and public.is_admin());

drop policy if exists "Admins can update post media" on storage.objects;
create policy "Admins can update post media"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'post-media' and public.is_admin())
  with check (bucket_id = 'post-media' and public.is_admin());

drop policy if exists "Admins can delete post media" on storage.objects;
create policy "Admins can delete post media"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'post-media' and public.is_admin());
