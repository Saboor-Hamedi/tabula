-- ==============================================================================
-- Lumina Tabula — Administration, Manual Pro Grants & User Security Controls
-- ------------------------------------------------------------------------------
-- Gives administrators full control over member plans (including 1-month Pro
-- grants by user ID or email), token balances, account suspension, member
-- removal, and an immutable security audit log.
--
-- Requires: accounts.sql, roles.sql, user_balances_and_drop_api_keys.sql
-- ==============================================================================


-- ------------------------------------------------------------------------------
-- 1. Profile columns: last sign-in & account suspension
-- ------------------------------------------------------------------------------
alter table public.profiles
  add column if not exists last_sign_in_at timestamptz;
alter table public.profiles
  add column if not exists is_suspended boolean not null default false;
alter table public.profiles
  add column if not exists suspended_reason text;
alter table public.profiles
  add column if not exists suspended_at timestamptz;

-- Ensure column-level update grants remain strictly locked for regular clients
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

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
-- 2. Administrators read every profile, subscription, and token balance
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

drop policy if exists "Admins can read all balances" on public.user_balances;
create policy "Admins can read all balances"
  on public.user_balances
  for select
  to authenticated
  using (public.is_admin());


-- ------------------------------------------------------------------------------
-- 3. Pre-Approved & Direct Email Pro Grants (admin_email_grants)
-- ------------------------------------------------------------------------------
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


-- ------------------------------------------------------------------------------
-- 4. Immutable Admin Security Audit Log (admin_audit_logs)
-- ------------------------------------------------------------------------------
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


-- ------------------------------------------------------------------------------
-- 5. Update handle_new_user() to auto-apply pre-approved Email Pro Grants
-- ------------------------------------------------------------------------------
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


-- ------------------------------------------------------------------------------
-- 6. Admin RPC: Grant Pro / Enterprise by Email (for 1 Month or custom duration)
-- ------------------------------------------------------------------------------
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


-- ------------------------------------------------------------------------------
-- 7. Admin RPC: Revoke Email Grant
-- ------------------------------------------------------------------------------
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


-- ------------------------------------------------------------------------------
-- 8. Admin RPC: Full Member Control (Plan, 1-Month Pro, Tokens, Suspend, Delete)
-- ------------------------------------------------------------------------------
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

  -- Action 1: Grant Pro for N days (default 30 days = 1 whole month)
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

  -- Action 2: Extend existing subscription window by +N days (default 30 days)
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

  -- Action 3: Reset to 7-day Free Trial (250,000 tokens)
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

  -- Action 4: Downgrade / Cancel Pro back to Free
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

  -- Action 5: Set custom token balance
  elsif p_action = 'set_tokens' then
    v_tokens := greatest(0, least(coalesce(p_tokens, 250000), 100000000));
    insert into public.user_balances (user_id, tokens_remaining, updated_at)
    values (p_target_user_id, v_tokens, v_now)
    on conflict (user_id) do update
      set tokens_remaining = excluded.tokens_remaining,
          updated_at = v_now;

  -- Action 6: Suspend account (freeze all AI queries & access)
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

    -- Block future logins & revoke all active sessions immediately
    update auth.users
       set banned_until = v_now + interval '100 years'
     where id = p_target_user_id;

    delete from auth.sessions where user_id = p_target_user_id;

  -- Action 7: Unsuspend account
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

  -- Action 8: Delete member account (non-admin only)
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

-- Refresh PostgREST schema cache so the app sees new RPCs & columns immediately
notify pgrst, 'reload schema';
