-- ==============================================================================
-- Lumina Tabula — Upgrade Migration: 7-Day Free Trial, Usage RPC & Admin-Only API Key
-- ------------------------------------------------------------------------------
-- Safe & idempotent script to run in Supabase Dashboard -> SQL Editor on an
-- existing Lumina Tabula database.
-- ==============================================================================

-- 1. Add trial_ends_at to subscriptions
alter table public.subscriptions
  add column if not exists trial_ends_at timestamptz;

-- 2. Backfill existing free accounts without a Stripe subscription so they have
--    a 7-day trial window measured from when their subscription row was created.
update public.subscriptions
   set status = 'trialing',
       current_period_start = coalesce(current_period_start, created_at),
       trial_ends_at = coalesce(trial_ends_at, created_at + interval '7 days'),
       current_period_end = coalesce(current_period_end, created_at + interval '7 days')
 where tier = 'free'
   and stripe_subscription_id is null
   and trial_ends_at is null;

-- 3. Update signup trigger so every new account gets a 7-day free trial (no card)
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
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    'free'
  );

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

  return new;
end;
$$;

-- 4. Accurate monthly token usage RPC (no PostgREST 1,000-row cap)
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

-- 5. Lock down user_api_keys so only the backend (service_role) & admins can manage it
alter table public.user_api_keys enable row level security;

drop policy if exists "Members read their own key" on public.user_api_keys;
drop policy if exists "Members add their own key" on public.user_api_keys;
drop policy if exists "Members update their own key" on public.user_api_keys;
drop policy if exists "Members delete their own key" on public.user_api_keys;
drop policy if exists "Admins manage platform key" on public.user_api_keys;

revoke all on table public.user_api_keys from public, anon, authenticated;

-- Remove any keys that were inserted by non-admin accounts
delete from public.user_api_keys k
 where not exists (
   select 1
   from public.profiles p
   where p.id = k.user_id
     and p.role = 'admin'
 );

create index if not exists idx_user_api_keys_provider_updated
  on public.user_api_keys (provider, updated_at desc);
