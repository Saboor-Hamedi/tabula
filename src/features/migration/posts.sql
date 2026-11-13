-- ==============================================================================
-- Lumina Tabula — Posts
-- ------------------------------------------------------------------------------
-- A published Lumina Tabula answer.
--
-- A post keeps the raw markdown *and* the parsed render blocks, so the public
-- page draws the exact same Mermaid diagrams, charts and tables the
-- administrator saw in the workspace. The author snapshot is denormalised on
-- purpose: `profiles` is not publicly readable, so the front page must not
-- depend on a join.
--
-- Requires: accounts.sql, roles.sql
-- ==============================================================================


-- ------------------------------------------------------------------------------
-- The status of a post
-- ------------------------------------------------------------------------------
do $$
begin
  create type public.post_status as enum ('draft', 'published', 'archived');
exception
  when duplicate_object then null;
end $$;


-- ------------------------------------------------------------------------------
-- posts
-- ------------------------------------------------------------------------------
create table if not exists public.posts (
  id uuid default gen_random_uuid() primary key,
  slug text not null unique,
  title text not null,
  subtitle text,
  excerpt text,

  -- The raw answer exactly as Lumina Tabula produced it.
  content text not null default '',

  -- Parsed render blocks, stored as JSON:
  --   [{ "type": "markdown" | "mermaid" | "chart" | "table", ... }]
  blocks jsonb not null default '[]'::jsonb,

  cover_image_url text,
  cover_caption text,

  source_message_id text,
  source_session_id text,
  dataset_name text,
  model text,

  author_id uuid references public.profiles(id) on delete set null,
  author_name text,
  author_avatar_url text,

  status public.post_status not null default 'draft',
  tags text[] not null default '{}',
  featured boolean not null default false,
  reading_time_minutes int not null default 1,
  view_count bigint not null default 0,

  published_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),

  constraint posts_title_length check (char_length(title) between 1 and 240),
  constraint posts_published_has_date check (
    status <> 'published' or published_at is not null
  )
);

comment on table public.posts is
  'Published Lumina Tabula answers. Public once published; writable only by administrators.';
comment on column public.posts.blocks is
  'JSON array of render blocks: {type:"markdown"|"mermaid"|"chart"|"table"}.';


-- ------------------------------------------------------------------------------
-- post_images — the gallery attached to a post
-- ------------------------------------------------------------------------------
create table if not exists public.post_images (
  id uuid default gen_random_uuid() primary key,
  post_id uuid not null references public.posts(id) on delete cascade,
  url text not null,
  storage_path text,
  alt_text text,
  caption text,
  width int,
  height int,
  position int not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now())
);


-- ------------------------------------------------------------------------------
-- RLS — posts
-- ------------------------------------------------------------------------------
-- Everyone may read a published post. Only administrators may write.
-- ------------------------------------------------------------------------------
alter table public.posts enable row level security;
grant select on public.posts to anon, authenticated;
grant insert, update, delete on public.posts to authenticated;

drop policy if exists "Published posts are public" on public.posts;
create policy "Published posts are public"
  on public.posts
  for select
  to anon, authenticated
  using (
    status = 'published'
    and published_at is not null
    and published_at <= timezone('utc'::text, now())
  );

drop policy if exists "Admins can read every post" on public.posts;
create policy "Admins can read every post"
  on public.posts
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can publish posts" on public.posts;
create policy "Admins can publish posts"
  on public.posts
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update posts" on public.posts;
create policy "Admins can update posts"
  on public.posts
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete posts" on public.posts;
create policy "Admins can delete posts"
  on public.posts
  for delete
  to authenticated
  using (public.is_admin());


-- ------------------------------------------------------------------------------
-- RLS — post images
-- ------------------------------------------------------------------------------
alter table public.post_images enable row level security;
grant select on public.post_images to anon, authenticated;
grant insert, update, delete on public.post_images to authenticated;

drop policy if exists "Images of published posts are public" on public.post_images;
create policy "Images of published posts are public"
  on public.post_images
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.posts p
      where p.id = post_images.post_id
        and p.status = 'published'
        and p.published_at is not null
        and p.published_at <= timezone('utc'::text, now())
    )
  );

drop policy if exists "Admins can read every image" on public.post_images;
create policy "Admins can read every image"
  on public.post_images
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can add images" on public.post_images;
create policy "Admins can add images"
  on public.post_images
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update images" on public.post_images;
create policy "Admins can update images"
  on public.post_images
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete images" on public.post_images;
create policy "Admins can delete images"
  on public.post_images
  for delete
  to authenticated
  using (public.is_admin());


-- ------------------------------------------------------------------------------
-- Write-time guards
-- ------------------------------------------------------------------------------
-- The client never decides who wrote a post and never decides when it went
-- live. Both come from the signed-in session.
-- ------------------------------------------------------------------------------
create or replace function public.stamp_post_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.author_id := auth.uid();
    select coalesce(p.display_name, p.email), p.avatar_url
      into new.author_name, new.author_avatar_url
      from public.profiles p
     where p.id = auth.uid();
    new.author_name := coalesce(new.author_name, 'Lumina Tabula');
  end if;

  if new.status = 'published' and new.published_at is null then
    new.published_at := timezone('utc'::text, now());
  end if;

  return new;
end;
$$;

drop trigger if exists stamp_post_author on public.posts;
create trigger stamp_post_author
  before insert or update on public.posts
  for each row execute function public.stamp_post_author();

drop trigger if exists set_posts_updated_at on public.posts;
create trigger set_posts_updated_at
  before update on public.posts
  for each row execute procedure public.handle_updated_at();


-- ------------------------------------------------------------------------------
-- The public view counter
-- ------------------------------------------------------------------------------
-- SECURITY DEFINER: the function owns the write, so a visitor never needs a
-- write policy on `posts`.
-- ------------------------------------------------------------------------------
create or replace function public.increment_post_view(post_slug text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count bigint;
begin
  update public.posts
     set view_count = view_count + 1
   where slug = post_slug
     and status = 'published'
  returning view_count into new_count;

  return coalesce(new_count, 0);
end;
$$;

revoke all on function public.increment_post_view(text) from public;
grant execute on function public.increment_post_view(text) to anon, authenticated;


-- ------------------------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------------------------
create index if not exists idx_posts_published_at
  on public.posts (published_at desc)
  where status = 'published';

create index if not exists idx_posts_status_published
  on public.posts (status, published_at desc);

create index if not exists idx_posts_author
  on public.posts (author_id);

create index if not exists idx_posts_tags
  on public.posts using gin (tags);

create index if not exists idx_posts_search
  on public.posts using gin (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(excerpt, '') || ' ' || coalesce(content, ''))
  );

create index if not exists idx_post_images_post
  on public.post_images (post_id, position);


-- ------------------------------------------------------------------------------
-- The feed the front page reads
-- ------------------------------------------------------------------------------
-- SECURITY INVOKER so the RLS policies above still apply.
-- ------------------------------------------------------------------------------
create or replace view public.published_posts
with (security_invoker = true)
as
select
  p.id,
  p.slug,
  p.title,
  p.subtitle,
  p.excerpt,
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
  p.updated_at
from public.posts p
where p.status = 'published'
  and p.published_at is not null
  and p.published_at <= timezone('utc'::text, now());

grant select on public.published_posts to anon, authenticated;
