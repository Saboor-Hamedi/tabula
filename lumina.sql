-- ==============================================================================
-- Lumina Desktop Sub-Project — Complete Supabase Schema (`lumina.sql`, Idempotent)
-- ------------------------------------------------------------------------------
-- Dedicated schema for the `/lumina` documentation, release updates, installer
-- downloads, and posts sub-project.
--
-- Security & Architecture Principles:
--   1. Every table, view, enum, trigger, index, and RPC function is prefixed with
--      `lumina_` so it never collides with or alters existing Tabula tables.
--   2. Strict Row-Level Security (RLS): public visitors can only SELECT published
--      rows; only active administrators (`public.is_admin()`) can INSERT, UPDATE,
--      or DELETE.
--   3. Pure `pg_trgm` Trigram Search (`%`, `<%`, `similarity`, `word_similarity`)
--      for both `lumina_posts` and `lumina_docs` — no `ILIKE` sequential scans.
--   4. No hardcoded release version or hardcoded posts: versions and star counts
--      are fetched dynamically from GitHub (`Saboor-Hamedi/lumina`) and cached in
--      `public.lumina_releases`; posts and docs are managed via full CRUD.
--
-- Safe to run on both a fresh or existing Supabase database via:
--   Supabase Dashboard -> SQL Editor -> Paste & Run
-- ==============================================================================


-- ==============================================================================
-- 1. Extensions & Shared Helpers
-- ==============================================================================
create extension if not exists pg_trgm;

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_admin'
  ) then
    execute $fn$
      create function public.is_admin()
      returns boolean
      language sql
      stable
      security definer
      set search_path = public
      as $body$
        select exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role::text = 'admin'
            and coalesce(p.is_suspended, false) = false
        );
      $body$;
    $fn$;
  end if;
end $$;


-- ==============================================================================
-- 2. Lumina Enums (`lumina_post_category`, `lumina_post_status`, `lumina_doc_section`)
-- ==============================================================================
do $$
begin
  create type public.lumina_post_category as enum (
    'Release',
    'Guide',
    'Feature',
    'Announcement'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.lumina_post_status as enum (
    'draft',
    'published',
    'archived'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.lumina_doc_section as enum (
    'Prologue',
    'Features',
    'Reference',
    'Legal'
  );
exception
  when duplicate_object then null;
end $$;


-- ==============================================================================
-- 3. `public.lumina_docs` (+ `public.lumina_documentations` View Alias)
-- ==============================================================================
create table if not exists public.lumina_docs (
  id uuid default gen_random_uuid() primary key,
  slug text not null unique,
  section public.lumina_doc_section not null default 'Prologue',
  title text not null,
  subtitle text,
  summary text,
  content text not null default '',
  sort_order int not null default 100,
  published boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint lumina_docs_slug_format check (
    char_length(slug) between 1 and 120
    and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint lumina_docs_title_length check (char_length(trim(title)) between 1 and 240),
  constraint lumina_docs_content_length check (char_length(content) <= 250000)
);

alter table public.lumina_docs enable row level security;

revoke all on table public.lumina_docs from public, anon, authenticated;
grant select on table public.lumina_docs to anon, authenticated;
grant insert, update, delete on table public.lumina_docs to authenticated;
grant all on table public.lumina_docs to service_role;

drop policy if exists "Lumina published docs are public" on public.lumina_docs;
create policy "Lumina published docs are public"
  on public.lumina_docs
  for select
  to anon, authenticated
  using (published = true);

drop policy if exists "Admins can read all lumina docs" on public.lumina_docs;
create policy "Admins can read all lumina docs"
  on public.lumina_docs
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can insert lumina docs" on public.lumina_docs;
create policy "Admins can insert lumina docs"
  on public.lumina_docs
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update lumina docs" on public.lumina_docs;
create policy "Admins can update lumina docs"
  on public.lumina_docs
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete lumina docs" on public.lumina_docs;
create policy "Admins can delete lumina docs"
  on public.lumina_docs
  for delete
  to authenticated
  using (public.is_admin());

drop trigger if exists set_lumina_docs_updated_at on public.lumina_docs;
create trigger set_lumina_docs_updated_at
  before update on public.lumina_docs
  for each row execute procedure public.handle_updated_at();

create index if not exists idx_lumina_docs_section_order
  on public.lumina_docs (section, sort_order asc);

create index if not exists idx_lumina_docs_title_trgm
  on public.lumina_docs using gin (title gin_trgm_ops);

create index if not exists idx_lumina_docs_subtitle_trgm
  on public.lumina_docs using gin (subtitle gin_trgm_ops);

create index if not exists idx_lumina_docs_summary_trgm
  on public.lumina_docs using gin (summary gin_trgm_ops);

create index if not exists idx_lumina_docs_content_trgm
  on public.lumina_docs using gin (content gin_trgm_ops);

create or replace view public.lumina_documentations
with (security_invoker = true)
as
select
  d.id,
  d.slug,
  d.section,
  d.title,
  d.subtitle,
  d.summary,
  d.content,
  d.sort_order,
  d.published,
  d.updated_by,
  d.created_at,
  d.updated_at
from public.lumina_docs d;

grant select on public.lumina_documentations to anon, authenticated;
grant insert, update, delete on public.lumina_documentations to authenticated;

-- Pure `pg_trgm` documentation search RPC (no ILIKE)
create or replace function public.lumina_search_docs(
  p_query text default null,
  p_include_drafts boolean default false,
  p_limit int default 20
)
returns table (
  id uuid,
  slug text,
  section public.lumina_doc_section,
  title text,
  subtitle text,
  summary text,
  content text,
  sort_order int,
  published boolean,
  updated_at timestamptz,
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
      d.id,
      d.slug,
      d.section,
      d.title,
      d.subtitle,
      d.summary,
      d.content,
      d.sort_order,
      d.published,
      d.updated_at,
      (
        case
          when (select term from q) is null then 0::real
          else greatest(
            similarity(d.title, (select term from q)) * 2.6,
            word_similarity((select term from q), d.title) * 2.3,
            similarity(coalesce(d.subtitle, ''), (select term from q)) * 1.5,
            word_similarity((select term from q), coalesce(d.subtitle, '')) * 1.4,
            similarity(coalesce(d.summary, ''), (select term from q)) * 1.3,
            word_similarity((select term from q), left(coalesce(d.content, ''), 4000)) * 1.0
          )::real
        end
      ) as rank
    from public.lumina_docs d
    cross join q
    where (d.published = true or (p_include_drafts = true and public.is_admin()))
      and (
        q.term is null
        or d.title % q.term
        or q.term <% d.title
        or coalesce(d.subtitle, '') % q.term
        or q.term <% coalesce(d.subtitle, '')
        or coalesce(d.summary, '') % q.term
        or q.term <% coalesce(d.content, '')
        or word_similarity(q.term, d.title) >= 0.25
        or word_similarity(q.term, coalesce(d.subtitle, '')) >= 0.25
        or word_similarity(q.term, left(coalesce(d.content, ''), 4000)) >= 0.3
      )
  )
  select
    m.id,
    m.slug,
    m.section,
    m.title,
    m.subtitle,
    m.summary,
    m.content,
    m.sort_order,
    m.published,
    m.updated_at,
    m.rank
  from matched m
  order by
    case when (select term from q) is not null then m.rank else 0 end desc,
    m.sort_order asc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

grant execute on function public.lumina_search_docs(text, boolean, int) to anon, authenticated;


-- ==============================================================================
-- 4. `public.lumina_posts` — Lumina Release Updates, Guides & Changelogs (Full CRUD)
-- ==============================================================================
create table if not exists public.lumina_posts (
  id uuid default gen_random_uuid() primary key,
  slug text not null unique,
  title text not null,
  category public.lumina_post_category not null default 'Release',
  status public.lumina_post_status not null default 'published',
  version text,
  summary text not null default '',
  content text not null default '',
  cover_image_url text,
  tags text[] not null default '{}',
  featured boolean not null default false,
  published boolean not null default true,
  reading_time_minutes int not null default 1,
  view_count bigint not null default 0,
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null default 'Saboor Hamedi',
  author_avatar_url text,
  published_at timestamptz default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint lumina_posts_slug_format check (
    char_length(slug) between 1 and 140
    and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint lumina_posts_title_length check (char_length(trim(title)) between 1 and 240),
  constraint lumina_posts_summary_length check (char_length(summary) <= 600),
  constraint lumina_posts_content_length check (char_length(content) <= 250000),
  constraint lumina_posts_cover_url_safe check (
    cover_image_url is null or cover_image_url ~ '^https?://'
  )
);

alter table public.lumina_posts
  add column if not exists status public.lumina_post_status not null default 'published';

alter table public.lumina_posts enable row level security;

revoke all on table public.lumina_posts from public, anon, authenticated;
grant select on table public.lumina_posts to anon, authenticated;
grant insert, update, delete on table public.lumina_posts to authenticated;
grant all on table public.lumina_posts to service_role;

drop policy if exists "Published lumina posts are public" on public.lumina_posts;
create policy "Published lumina posts are public"
  on public.lumina_posts
  for select
  to anon, authenticated
  using (published = true and status = 'published');

drop policy if exists "Admins can read all lumina posts" on public.lumina_posts;
create policy "Admins can read all lumina posts"
  on public.lumina_posts
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can insert lumina posts" on public.lumina_posts;
create policy "Admins can insert lumina posts"
  on public.lumina_posts
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update lumina posts" on public.lumina_posts;
create policy "Admins can update lumina posts"
  on public.lumina_posts
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete lumina posts" on public.lumina_posts;
create policy "Admins can delete lumina posts"
  on public.lumina_posts
  for delete
  to authenticated
  using (public.is_admin());

create or replace function public.lumina_stamp_post_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.published := (new.status = 'published');
  elsif new.published is distinct from old.published then
    new.status := case when new.published then 'published'::public.lumina_post_status else 'draft'::public.lumina_post_status end;
  end if;

  if auth.uid() is not null then
    new.author_id := auth.uid();
    if to_regclass('public.profiles') is not null then
      select coalesce(p.display_name, p.email), p.avatar_url
        into new.author_name, new.author_avatar_url
        from public.profiles p
       where p.id = auth.uid();
    end if;
    new.author_name := coalesce(new.author_name, 'Saboor Hamedi');
  end if;

  if new.published = true and new.published_at is null then
    new.published_at := timezone('utc'::text, now());
  end if;

  return new;
end;
$$;

drop trigger if exists lumina_stamp_post_author on public.lumina_posts;
create trigger lumina_stamp_post_author
  before insert or update on public.lumina_posts
  for each row execute function public.lumina_stamp_post_author();

drop trigger if exists set_lumina_posts_updated_at on public.lumina_posts;
create trigger set_lumina_posts_updated_at
  before update on public.lumina_posts
  for each row execute procedure public.handle_updated_at();

create index if not exists idx_lumina_posts_published_at
  on public.lumina_posts (published_at desc)
  where published = true;

create index if not exists idx_lumina_posts_status
  on public.lumina_posts (status, published_at desc);

create index if not exists idx_lumina_posts_category
  on public.lumina_posts (category, published_at desc);

create index if not exists idx_lumina_posts_tags
  on public.lumina_posts using gin (tags);

create index if not exists idx_lumina_posts_title_trgm
  on public.lumina_posts using gin (title gin_trgm_ops);

create index if not exists idx_lumina_posts_summary_trgm
  on public.lumina_posts using gin (summary gin_trgm_ops);

create index if not exists idx_lumina_posts_version_trgm
  on public.lumina_posts using gin (version gin_trgm_ops);

create index if not exists idx_lumina_posts_content_trgm
  on public.lumina_posts using gin (content gin_trgm_ops);

-- Pure `pg_trgm` posts search RPC (no ILIKE)
create or replace function public.lumina_search_posts(
  p_query text default null,
  p_category public.lumina_post_category default null,
  p_include_drafts boolean default false,
  p_limit int default 24,
  p_offset int default 0
)
returns table (
  id uuid,
  slug text,
  title text,
  category public.lumina_post_category,
  status public.lumina_post_status,
  version text,
  summary text,
  content text,
  cover_image_url text,
  tags text[],
  featured boolean,
  published boolean,
  reading_time_minutes int,
  view_count bigint,
  author_name text,
  author_avatar_url text,
  published_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
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
      p.category,
      p.status,
      p.version,
      p.summary,
      p.content,
      p.cover_image_url,
      p.tags,
      p.featured,
      p.published,
      p.reading_time_minutes,
      p.view_count,
      p.author_name,
      p.author_avatar_url,
      p.published_at,
      p.created_at,
      p.updated_at,
      (
        case
          when (select term from q) is null then 0::real
          else greatest(
            similarity(p.title, (select term from q)) * 2.5,
            word_similarity((select term from q), p.title) * 2.2,
            similarity(coalesce(p.summary, ''), (select term from q)) * 1.4,
            word_similarity((select term from q), coalesce(p.summary, '')) * 1.3,
            similarity(coalesce(p.version, ''), (select term from q)) * 1.8,
            word_similarity((select term from q), left(coalesce(p.content, ''), 3000)) * 0.9
          )::real
        end
      ) as rank
    from public.lumina_posts p
    cross join q
    where (
        (p.published = true and p.status = 'published')
        or (p_include_drafts = true and public.is_admin())
      )
      and (p_category is null or p.category = p_category)
      and (
        q.term is null
        or p.title % q.term
        or q.term <% p.title
        or coalesce(p.summary, '') % q.term
        or q.term <% coalesce(p.summary, '')
        or coalesce(p.version, '') % q.term
        or q.term <% coalesce(p.content, '')
        or word_similarity(q.term, p.title) >= 0.25
        or word_similarity(q.term, coalesce(p.summary, '')) >= 0.25
        or word_similarity(q.term, left(coalesce(p.content, ''), 3000)) >= 0.3
      )
  )
  select
    m.id,
    m.slug,
    m.title,
    m.category,
    m.status,
    m.version,
    m.summary,
    m.content,
    m.cover_image_url,
    m.tags,
    m.featured,
    m.published,
    m.reading_time_minutes,
    m.view_count,
    m.author_name,
    m.author_avatar_url,
    m.published_at,
    m.created_at,
    m.updated_at,
    count(*) over () as total_count,
    m.rank
  from matched m
  order by
    case when (select term from q) is not null then m.rank else 0 end desc,
    m.featured desc,
    m.published_at desc nulls last,
    m.created_at desc
  limit greatest(1, least(coalesce(p_limit, 24), 50))
  offset greatest(0, coalesce(p_offset, 0));
$$;

grant execute on function public.lumina_search_posts(text, public.lumina_post_category, boolean, int, int) to anon, authenticated;

create or replace function public.lumina_increment_post_view(p_slug text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  update public.lumina_posts
     set view_count = view_count + 1
   where slug = trim(coalesce(p_slug, ''))
     and published = true
     and status = 'published'
  returning view_count into v_count;

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.lumina_increment_post_view(text) from public;
grant execute on function public.lumina_increment_post_view(text) to anon, authenticated;


-- ==============================================================================
-- 5. `public.lumina_releases` & `public.lumina_downloads`
-- ==============================================================================
create table if not exists public.lumina_releases (
  id uuid default gen_random_uuid() primary key,
  tag_name text not null unique,
  version text not null,
  name text,
  notes text,
  stars_count int not null default 0,
  windows_exe_url text,
  windows_msi_url text,
  macos_dmg_url text,
  linux_deb_url text,
  linux_appimage_url text,
  html_url text not null default 'https://github.com/Saboor-Hamedi/lumina/releases/latest',
  is_latest boolean not null default true,
  published_at timestamptz default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint lumina_releases_urls_safe check (
    (windows_exe_url is null or windows_exe_url ~ '^https://')
    and (windows_msi_url is null or windows_msi_url ~ '^https://')
    and (macos_dmg_url is null or macos_dmg_url ~ '^https://')
    and (linux_deb_url is null or linux_deb_url ~ '^https://')
    and (linux_appimage_url is null or linux_appimage_url ~ '^https://')
    and html_url ~ '^https://'
  )
);

alter table public.lumina_releases
  add column if not exists stars_count int not null default 0;

alter table public.lumina_releases enable row level security;

revoke all on table public.lumina_releases from public, anon, authenticated;
grant select on table public.lumina_releases to anon, authenticated;
grant insert, update, delete on table public.lumina_releases to authenticated;
grant all on table public.lumina_releases to service_role;

drop policy if exists "Lumina releases are publicly readable" on public.lumina_releases;
create policy "Lumina releases are publicly readable"
  on public.lumina_releases
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can manage lumina releases" on public.lumina_releases;
create policy "Admins can manage lumina releases"
  on public.lumina_releases
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop trigger if exists set_lumina_releases_updated_at on public.lumina_releases;
create trigger set_lumina_releases_updated_at
  before update on public.lumina_releases
  for each row execute procedure public.handle_updated_at();

create or replace function public.lumina_cache_github_release(
  p_tag_name text,
  p_version text,
  p_name text default null,
  p_html_url text default 'https://github.com/Saboor-Hamedi/lumina/releases/latest',
  p_windows_exe_url text default null,
  p_windows_msi_url text default null,
  p_macos_dmg_url text default null,
  p_linux_deb_url text default null,
  p_linux_appimage_url text default null,
  p_published_at timestamptz default null,
  p_stars_count int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tag text := left(trim(coalesce(p_tag_name, '')), 64);
  v_ver text := left(trim(coalesce(p_version, '')), 64);
  v_prefix text := 'https://github.com/Saboor-Hamedi/lumina/';
begin
  if v_tag = '' or v_ver = '' or v_tag !~ '^[vV]?[0-9]+\.[0-9]+(\.[0-9]+)?(-[a-zA-Z0-9._-]+)?$' then
    return;
  end if;

  if p_html_url is not null and left(p_html_url, length(v_prefix)) <> v_prefix then
    return;
  end if;
  if p_windows_exe_url is not null and left(p_windows_exe_url, length(v_prefix)) <> v_prefix then
    return;
  end if;
  if p_windows_msi_url is not null and left(p_windows_msi_url, length(v_prefix)) <> v_prefix then
    return;
  end if;
  if p_macos_dmg_url is not null and left(p_macos_dmg_url, length(v_prefix)) <> v_prefix then
    return;
  end if;
  if p_linux_deb_url is not null and left(p_linux_deb_url, length(v_prefix)) <> v_prefix then
    return;
  end if;
  if p_linux_appimage_url is not null and left(p_linux_appimage_url, length(v_prefix)) <> v_prefix then
    return;
  end if;

  update public.lumina_releases set is_latest = false where is_latest = true and tag_name <> v_tag;

  insert into public.lumina_releases (
    tag_name,
    version,
    name,
    html_url,
    stars_count,
    windows_exe_url,
    windows_msi_url,
    macos_dmg_url,
    linux_deb_url,
    linux_appimage_url,
    is_latest,
    published_at
  )
  values (
    v_tag,
    v_ver,
    left(trim(coalesce(p_name, v_ver)), 120),
    coalesce(p_html_url, 'https://github.com/Saboor-Hamedi/lumina/releases/latest'),
    greatest(0, coalesce(p_stars_count, 0)),
    p_windows_exe_url,
    p_windows_msi_url,
    p_macos_dmg_url,
    p_linux_deb_url,
    p_linux_appimage_url,
    true,
    coalesce(p_published_at, timezone('utc'::text, now()))
  )
  on conflict (tag_name) do update
    set version = excluded.version,
        name = excluded.name,
        html_url = excluded.html_url,
        stars_count = greatest(excluded.stars_count, public.lumina_releases.stars_count),
        windows_exe_url = coalesce(excluded.windows_exe_url, public.lumina_releases.windows_exe_url),
        windows_msi_url = coalesce(excluded.windows_msi_url, public.lumina_releases.windows_msi_url),
        macos_dmg_url = coalesce(excluded.macos_dmg_url, public.lumina_releases.macos_dmg_url),
        linux_deb_url = coalesce(excluded.linux_deb_url, public.lumina_releases.linux_deb_url),
        linux_appimage_url = coalesce(excluded.linux_appimage_url, public.lumina_releases.linux_appimage_url),
        is_latest = true,
        updated_at = timezone('utc'::text, now());
end;
$$;

revoke all on function public.lumina_cache_github_release(text, text, text, text, text, text, text, text, text, timestamptz, int) from public;
grant execute on function public.lumina_cache_github_release(text, text, text, text, text, text, text, text, text, timestamptz, int) to anon, authenticated;

create table if not exists public.lumina_downloads (
  id bigserial primary key,
  platform text not null check (platform in ('windows', 'macos', 'linux', 'source')),
  installer_format text,
  version text,
  download_url text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.lumina_downloads enable row level security;
revoke all on public.lumina_downloads from public, anon, authenticated;
grant select on public.lumina_downloads to authenticated;
grant all on public.lumina_downloads to service_role;

drop policy if exists "Admins can view lumina download stats" on public.lumina_downloads;
create policy "Admins can view lumina download stats"
  on public.lumina_downloads
  for select
  to authenticated
  using (public.is_admin());

create or replace function public.lumina_record_download(
  p_platform text,
  p_installer_format text default null,
  p_version text default null,
  p_download_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_platform text := lower(trim(coalesce(p_platform, 'windows')));
begin
  if v_platform not in ('windows', 'macos', 'linux', 'source') then
    v_platform := 'source';
  end if;

  insert into public.lumina_downloads (platform, installer_format, version, download_url)
  values (
    v_platform,
    left(trim(coalesce(p_installer_format, '')), 40),
    left(trim(coalesce(p_version, '')), 40),
    left(trim(coalesce(p_download_url, '')), 500)
  );
end;
$$;

revoke all on function public.lumina_record_download(text, text, text, text) from public;
grant execute on function public.lumina_record_download(text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
