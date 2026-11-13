-- ==============================================================================
-- Lumina Tabula — Platform API Key (Admin-only, backend-managed)
-- ------------------------------------------------------------------------------
-- Stores the single shared platform DeepSeek API key.
--
-- Security model:
--   * No browser client (neither regular members nor admins) can read, insert,
--     update, or delete rows directly via PostgREST.
--   * All privileges for `anon` and `authenticated` are revoked, and RLS is
--     enabled with zero client policies (deny-all).
--   * Only the backend proxy (`SUPABASE_SERVICE_ROLE_KEY`) reads and writes this
--     table after verifying `role = 'admin'` on the server, and encrypts
--     `key_value` before writing.
--
-- Requires: accounts.sql, roles.sql
-- ==============================================================================


-- ------------------------------------------------------------------------------
-- The table
-- ------------------------------------------------------------------------------
create table if not exists public.user_api_keys (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'deepseek',

  -- Encrypted at rest by the backend proxy (`enc:v1:...`). Never exposed to clients.
  key_value text not null,

  -- SHA-256 fingerprint for audit/deduplication.
  key_fingerprint text not null,

  label text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),

  unique (user_id, provider)
);

comment on table public.user_api_keys is
  'Platform model API key. Managed exclusively by administrators through the backend proxy (service_role only).';

alter table public.user_api_keys enable row level security;

-- Drop any legacy per-member policies so no regular user can ever read/write keys.
drop policy if exists "Members read their own key" on public.user_api_keys;
drop policy if exists "Members add their own key" on public.user_api_keys;
drop policy if exists "Members update their own key" on public.user_api_keys;
drop policy if exists "Members delete their own key" on public.user_api_keys;
drop policy if exists "Admins manage platform key" on public.user_api_keys;

-- Revoke all direct PostgREST access from client roles; only service_role reads/writes.
revoke all on table public.user_api_keys from public, anon, authenticated;

create index if not exists idx_user_api_keys_user
  on public.user_api_keys (user_id, provider);

create index if not exists idx_user_api_keys_provider_updated
  on public.user_api_keys (provider, updated_at desc);

drop trigger if exists set_user_api_keys_updated_at on public.user_api_keys;
create trigger set_user_api_keys_updated_at
  before update on public.user_api_keys
  for each row execute procedure public.handle_updated_at();
