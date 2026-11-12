-- ==============================================================================
-- Tabula — Accounts
-- ------------------------------------------------------------------------------
-- The tables behind an account: the profile, the subscription and the usage
-- ledger. Everything a person signs up with lives here.
--
-- Apply order: 1. accounts.sql  2. roles.sql  3. posts.sql  4. media.sql
--               5. admin.sql     6. api_keys.sql
-- ==============================================================================


-- ------------------------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------------------------
do $$
begin
  create type public.pricing_tier as enum ('free', 'pro', 'enterprise');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete');
exception
  when duplicate_object then null;
end $$;


-- ------------------------------------------------------------------------------
-- Profiles — one row per account, linked to auth.users
-- ------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  display_name text,
  avatar_url text,
  tier public.pricing_tier not null default 'free',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Users can update own display profile" on public.profiles;
create policy "Users can update own display profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);


-- ------------------------------------------------------------------------------
-- Subscriptions — 7-day free trial on signup, then managed by Stripe webhook
-- ------------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
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

alter table public.subscriptions enable row level security;

drop policy if exists "Users can view own subscription" on public.subscriptions;
create policy "Users can view own subscription"
  on public.subscriptions
  for select
  using (auth.uid() = user_id);

-- Only the service role writes subscriptions, so a client cannot forge a plan.


-- ------------------------------------------------------------------------------
-- Usage ledger — one row per question, for metering
-- ------------------------------------------------------------------------------
create table if not exists public.usage_ledger (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
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
  using (auth.uid() = user_id);


-- ------------------------------------------------------------------------------
-- Triggers & Usage RPC
-- ------------------------------------------------------------------------------

-- A profile and a 7-day free trial subscription appear the moment an account
-- is created (no payment method required).
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Accurate monthly token totals in SQL (avoids REST row-limit truncation).
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

-- Keeps `updated_at` honest on every table that has one.
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute procedure public.handle_updated_at();


-- ------------------------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------------------------
create index if not exists idx_subscriptions_user_id on public.subscriptions (user_id);
create index if not exists idx_usage_user_id on public.usage_ledger (user_id);
create index if not exists idx_usage_created_at on public.usage_ledger (created_at desc);
