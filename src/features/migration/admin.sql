-- ==============================================================================
-- Tabula — Administration
-- ------------------------------------------------------------------------------
-- What an administrator sees about the people on the account: when they signed
-- up, when they last signed in, and the window of their subscription.
--
-- Requires: accounts.sql, roles.sql
-- ==============================================================================


-- ------------------------------------------------------------------------------
-- The last sign-in
-- ------------------------------------------------------------------------------
-- The timestamp lives on auth.users, which no client can read. A trigger
-- copies it onto the profile so the dashboard can show it.
-- ------------------------------------------------------------------------------
alter table public.profiles
  add column if not exists last_sign_in_at timestamptz;

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


-- ------------------------------------------------------------------------------
-- Administrators read every profile and every subscription
-- ------------------------------------------------------------------------------
-- These are the only two policies that widen what a signed-in account can
-- read. Nothing else in the schema is visible to an administrator that is not
-- already visible to its owner.
-- ------------------------------------------------------------------------------
drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can read all subscriptions" on public.subscriptions;
create policy "Admins can read all subscriptions"
  on public.subscriptions
  for select
  to authenticated
  using (public.is_admin());
