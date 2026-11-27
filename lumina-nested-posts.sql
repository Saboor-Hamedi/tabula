-- ==============================================================================
-- Lumina nested posts — additive migration (`lumina-nested-posts.sql`)
-- ------------------------------------------------------------------------------
-- Safe to paste into Supabase Dashboard -> SQL Editor -> Run, even if the full
-- `lumina.sql` has already been applied. Re-running is idempotent.
-- ==============================================================================

alter table public.lumina_posts
  add column if not exists parent_slug text,
  add column if not exists sort_order int not null default 100;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lumina_posts_parent_slug_check') then
    alter table public.lumina_posts add constraint lumina_posts_parent_slug_check
      check (
        parent_slug is null
        or (
          char_length(parent_slug) between 1 and 140
          and parent_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
        )
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'lumina_posts_parent_not_self') then
    alter table public.lumina_posts add constraint lumina_posts_parent_not_self
      check (parent_slug is null or parent_slug <> slug);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'lumina_posts_parent_slug_fkey') then
    alter table public.lumina_posts add constraint lumina_posts_parent_slug_fkey
      foreign key (parent_slug) references public.lumina_posts(slug)
      on delete set null on update cascade;
  end if;
end $$;

create index if not exists idx_lumina_posts_parent_order
  on public.lumina_posts (parent_slug, sort_order asc);

-- Extend the search RPC so nested posts survive search results.
drop function if exists public.lumina_search_posts(text, public.lumina_post_category, boolean, int, int);

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
  parent_slug text,
  sort_order int,
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
    select nullif(left(trim(coalesce(p_query, '')), 120), '') as term
  ),
  matched as (
    select
      p.id, p.slug, p.title, p.category, p.status, p.version, p.summary,
      p.content, p.cover_image_url, p.tags, p.featured, p.parent_slug,
      p.sort_order, p.published, p.reading_time_minutes, p.view_count,
      p.author_name, p.author_avatar_url, p.published_at, p.created_at,
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
        or q.term <% p.content
        or word_similarity(q.term, p.title) >= 0.25
        or word_similarity(q.term, coalesce(p.summary, '')) >= 0.25
        or word_similarity(q.term, left(coalesce(p.content, ''), 3000)) >= 0.3
      )
  )
  select
    m.id, m.slug, m.title, m.category, m.status, m.version, m.summary,
    m.content, m.cover_image_url, m.tags, m.featured, m.parent_slug,
    m.sort_order, m.published, m.reading_time_minutes, m.view_count,
    m.author_name, m.author_avatar_url, m.published_at, m.created_at,
    m.updated_at,
    count(*) over () as total_count,
    m.rank
  from matched m
  order by
    case when (select term from q) is not null then m.rank else 0 end desc,
    m.featured desc,
    coalesce(m.sort_order, 100) asc,
    m.published_at desc nulls last,
    m.created_at desc
  limit greatest(1, least(coalesce(p_limit, 24), 50))
  offset greatest(0, coalesce(p_offset, 0));
$$;

grant execute on function public.lumina_search_posts(text, public.lumina_post_category, boolean, int, int) to anon, authenticated;

-- Required: refresh PostgREST's schema cache so the new columns are visible.
notify pgrst, 'reload schema';
