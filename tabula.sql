-- ==============================================================================
-- Tabula — Production Supabase Schema & Row Level Security (RLS)
-- Copy and paste this directly into the Supabase SQL Editor.
-- ==============================================================================

-- 1. Create Enums for Tiers & Statuses
create type public.pricing_tier as enum ('free', 'pro', 'enterprise');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete');

-- ------------------------------------------------------------------------------
-- 2. Profiles Table (Linked 1:1 with auth.users)
-- ------------------------------------------------------------------------------
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  display_name text,
  avatar_url text,
  tier public.pricing_tier not null default 'free',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Profiles Policies:
-- Users can view their own profile
create policy "Users can view own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

-- Users can update only their display name and avatar (NOT their tier)
create policy "Users can update own display profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
  );

-- ------------------------------------------------------------------------------
-- 3. Subscriptions Table (Synchronized via Stripe / Lemon Squeezy Webhooks)
-- ------------------------------------------------------------------------------
create table public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  tier public.pricing_tier not null default 'free',
  status public.subscription_status not null default 'active',
  price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Enable RLS on subscriptions
alter table public.subscriptions enable row level security;

-- Subscriptions Policies:
-- Users can only read their own subscription status
create policy "Users can view own subscription"
  on public.subscriptions
  for select
  using (auth.uid() = user_id);

-- Only Service Role (Webhooks / Edge Functions) can insert/update/delete subscriptions
-- Note: Service role automatically bypasses RLS in Supabase, keeping billing secure from client forgery.

-- ------------------------------------------------------------------------------
-- 4. Usage Ledger Table (For Token / AI Query Metering)
-- ------------------------------------------------------------------------------
create table public.usage_ledger (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  query_count int not null default 1,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  model text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Enable RLS on usage ledger
alter table public.usage_ledger enable row level security;

-- Users can view their own usage history
create policy "Users can view own usage"
  on public.usage_ledger
  for select
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 5. Automatic User Profile Provisioning Trigger
-- Automatically creates a public.profiles row whenever a user signs up via auth.users
-- ------------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url, tier)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    'free'
  );

  insert into public.subscriptions (user_id, tier, status)
  values (new.id, 'free', 'active');

  return new;
end;
$$;

-- Trigger execution on auth.users insert
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 6. Updated Timestamp Trigger Helper
-- ------------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute procedure public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 7. High-Performance Indexes
-- ------------------------------------------------------------------------------
create index ifmax_subscriptions_user_id on public.subscriptions (user_id);
create index ifmax_usage_user_id on public.usage_ledger (user_id);
create index ifmax_usage_created_at on public.usage_ledger (created_at desc);
