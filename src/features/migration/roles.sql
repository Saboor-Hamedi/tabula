-- ==============================================================================
-- Lumina Tabula — Roles
-- ------------------------------------------------------------------------------
-- Who is allowed to publish, and who is allowed to change a role.
--
-- One function, `public.is_admin()`, is the single source of truth for write
-- access. It is SECURITY DEFINER so it can read `profiles` even though a
-- member's own policy only exposes their own row.
--
-- Requires: accounts.sql
-- ==============================================================================


-- ------------------------------------------------------------------------------
-- The role itself
-- ------------------------------------------------------------------------------
do $$
begin
  create type public.app_role as enum ('user', 'admin');
exception
  when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists role public.app_role not null default 'user';

update public.profiles set role = 'user' where role is null;


-- ------------------------------------------------------------------------------
-- is_admin()
-- ------------------------------------------------------------------------------
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
  );
$$;

comment on function public.is_admin() is
  'True when the current auth.uid() belongs to a profile with role = admin.';


-- ------------------------------------------------------------------------------
-- Nobody promotes themselves
-- ------------------------------------------------------------------------------
-- The update policy lets a member edit their own row, so without this trigger
-- a member could write role = 'admin' and take over the account.
-- `auth.uid() is null` is the service-role path and stays allowed.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only administrators can change an account role.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_role on public.profiles;
create trigger guard_profile_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- Belt and braces: the table-level UPDATE grant is revoked and re-granted per
-- column, so a client physically cannot write tier or role.
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;


-- ------------------------------------------------------------------------------
-- Promote the first administrator
-- ------------------------------------------------------------------------------
-- Run this once, from the SQL editor:
--
--   update public.profiles set role = 'admin' where email = 'you@example.com';
--
-- Verify:
--   select id, email, display_name, role from public.profiles order by created_at;
