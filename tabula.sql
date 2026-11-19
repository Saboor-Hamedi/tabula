-- ==============================================================================
-- Tabula — Supabase schema
-- ------------------------------------------------------------------------------
-- The schema now lives in one file per feature, under
-- `src/features/migration/`. This file is the map: it says what to run and in
-- what order.
--
-- Apply with the Supabase CLI:
--
--   supabase db push
--
-- Or from the Supabase Dashboard -> SQL Editor, run the files in this order.
-- Every file is idempotent, so running one twice is safe.
--
--   1. accounts.sql   the tables behind an account: profile, 7-day trial, usage RPC
--   2. roles.sql      who may publish, and who may change a role
--   3. posts.sql      published answers, their images and the public feed
--   4. media.sql      the storage bucket for published images
--   5. admin.sql      what an administrator sees about the members
--   6. api_keys.sql   admin-only platform model key (backend service_role only)
--   7. trial_and_security.sql  idempotent upgrade script for existing databases
--
-- `queries.sql` is not schema: it is the list of requests the app makes.
-- ==============================================================================

-- ==============================================================================
-- Trigram (pg_trgm) Search & Auto-Suggestions for Published Posts
-- Run this directly in the Supabase Dashboard -> SQL Editor.
-- ==============================================================================
create extension if not exists pg_trgm;

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
            + case when p.title ilike '%' || (select term from q) || '%' then 1.0 else 0.0 end
          )::real
        end
      ) as rank
    from public.posts p
    cross join q
    where p.status = 'published'
      and (p_tag is null or p.tags @> array[p_tag])
      and (
        q.term is null
        or p.title ilike '%' || q.term || '%'
        or p.subtitle ilike '%' || q.term || '%'
        or p.excerpt ilike '%' || q.term || '%'
        or p.dataset_name ilike '%' || q.term || '%'
        or p.content ilike '%' || q.term || '%'
        or p.title % q.term
        or q.term <% p.title
        or coalesce(p.subtitle, '') % q.term
        or coalesce(p.excerpt, '') % q.term
        or coalesce(p.dataset_name, '') % q.term
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

-- ==============================================================================
-- Self-Service Account Deletion & Admin Security Hardening
-- 1. Permanently deletes the signed-in non-admin user's account and cascades to
--    profiles, subscriptions, and usage_ledger.
-- 2. Strictly blocks administrators from deleting their own account (42501).
-- 3. Prevents admins from accidentally demoting themselves and locks down
--    sensitive profile columns (role, tier, email) from client-side tampering.
-- Run this directly in the Supabase Dashboard -> SQL Editor.
-- ==============================================================================
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.id = v_uid
      and p.role = 'admin'
  ) into v_is_admin;

  if v_is_admin then
    raise exception 'Administrator accounts cannot be self-deleted.'
      using errcode = '42501';
  end if;

  if to_regclass('public.posts') is not null then
    delete from public.posts where author_id = v_uid;
  end if;

  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Prevent self-escalation and accidental admin self-demotion
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
      raise exception 'Subscription tier can only be updated by billing.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_role on public.profiles;
create trigger guard_profile_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
