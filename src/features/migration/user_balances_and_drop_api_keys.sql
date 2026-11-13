-- ==============================================================================
-- Lumina Tabula — Migration: Replace user_api_key(s) with user_balances & Edge Proxy
-- ------------------------------------------------------------------------------
-- Safe & idempotent SQL migration for Supabase Dashboard -> SQL Editor.
--
-- 1. Drops the legacy user_api_key / user_api_keys table so no API key is ever
--    stored in a database table. DEEPSEEK_API_KEY lives exclusively in
--    Supabase Edge Function Secrets.
-- 2. Creates public.user_balances (user_id, tokens_remaining) defaulting to
--    250,000 tokens for new signups via auth.users trigger.
-- 3. Enables RLS so authenticated users can only SELECT their own balance, and
--    only service_role can UPDATE tokens_remaining.
-- 4. Provides an atomic deduct_user_tokens() RPC for the deepseek-proxy Edge
--    Function (service_role only).
-- ==============================================================================

-- 1. Remove legacy API key tables
drop table if exists public.user_api_keys cascade;
drop table if exists public.user_api_key cascade;

-- 2. Create user_balances table
create table if not exists public.user_balances (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tokens_remaining integer not null default 250000 check (tokens_remaining >= 0),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.user_balances is
  'Per-user remaining token balance. Users may SELECT their own row; only service_role may UPDATE.';

-- 3. Enable Row Level Security (RLS)
alter table public.user_balances enable row level security;

drop policy if exists "Users read own balance" on public.user_balances;
drop policy if exists "Service role manages balances" on public.user_balances;

revoke all on table public.user_balances from public, anon, authenticated;
grant select on table public.user_balances to authenticated;
grant all on table public.user_balances to service_role;

create policy "Users read own balance"
  on public.user_balances
  for select
  to authenticated
  using (auth.uid() = user_id);

-- 4. Keep updated_at current on updates
create or replace function public.touch_user_balances_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_user_balances_updated_at on public.user_balances;
create trigger set_user_balances_updated_at
  before update on public.user_balances
  for each row execute function public.touch_user_balances_updated_at();

-- Ensure trial_ends_at exists on subscriptions
alter table public.subscriptions
  add column if not exists trial_ends_at timestamptz;

-- 5. Update signup trigger so every new user starts with 250,000 tokens
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc'::text, now());
  v_trial_end timestamptz := timezone('utc'::text, now()) + interval '7 days';
begin
  insert into public.profiles (id, email, display_name, avatar_url, tier)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    'free'
  )
  on conflict (id) do nothing;

  if not exists (select 1 from public.subscriptions where user_id = new.id) then
    insert into public.subscriptions (
      user_id,
      tier,
      status,
      trial_ends_at,
      current_period_start,
      current_period_end
    )
    values (
      new.id,
      'free',
      'trialing',
      v_trial_end,
      v_now,
      v_trial_end
    );
  end if;

  insert into public.user_balances (user_id, tokens_remaining)
  values (new.id, 250000)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Ensure trigger on auth.users is attached
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6. Backfill user_balances for any existing accounts
insert into public.user_balances (user_id, tokens_remaining)
select id, 250000
from auth.users
on conflict (user_id) do nothing;

-- 7. Atomic token deduction RPC (service_role only, clamped at 0)
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
