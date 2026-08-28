-- V2.1 Academy: additive versioned education content and private learning progress.

create table public.academy_articles (
  id uuid primary key default gen_random_uuid(),
  content_key text not null,
  slug text not null,
  version integer not null check (version >= 1),
  status text not null check (status in ('draft','reviewed','published','superseded','archived')),
  supersedes_id uuid references public.academy_articles(id),
  title text not null,
  summary_20s text not null,
  body_markdown text not null,
  reading_minutes integer not null check (reading_minutes >= 1),
  topic_tags text[] not null default '{}',
  audiences text[] not null default '{}',
  mission_keys text[] not null default '{}',
  barrier_types text[] not null default '{}',
  passport_pillars text[] not null default '{}',
  readiness_states text[] not null default '{}',
  safety_tags text[] not null default '{}',
  sensitivity text not null check (sensitivity in ('standard','sensitive','regulated_adjacent')),
  source_name text not null,
  source_url text,
  reviewer text not null,
  reviewed_at timestamptz not null,
  review_due_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_key, version),
  check (audiences <@ array['general','adult','under18']::text[]),
  check (barrier_types <@ array['credit_invisible','thin_file','new_to_uk','credit_rebuilder','affordability_constrained','optimiser']::text[]),
  check (passport_pillars <@ array['identity','payment_health','debt_headroom','affordability_stability','application_readiness']::text[]),
  check (readiness_states <@ array['red','amber','green','unknown']::text[]),
  check (safety_tags <@ array['general','under18_safe','safe_mode_safe','application_oriented','borrowing_oriented']::text[])
);

create unique index academy_articles_one_published_content_key
  on public.academy_articles(content_key) where status = 'published';

create unique index academy_articles_one_published_slug
  on public.academy_articles(slug) where status = 'published';

create index academy_articles_supersedes_id_idx
  on public.academy_articles(supersedes_id)
  where supersedes_id is not null;

create table public.academy_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_key text not null,
  last_article_id uuid not null references public.academy_articles(id),
  first_shown_at timestamptz,
  last_shown_at timestamptz,
  opened_at timestamptz,
  completed_at timestamptz,
  still_confused_at timestamptz,
  last_source_context text check (
    last_source_context is null
    or last_source_context in ('quest_feed','learn_home','article','related_article','mission')
  ),
  updated_at timestamptz not null default now(),
  primary key (user_id, content_key)
);

create index academy_progress_last_article_id_idx
  on public.academy_progress(last_article_id);

alter table public.academy_articles enable row level security;
alter table public.academy_progress enable row level security;

revoke all on public.academy_articles from anon, authenticated;
revoke all on public.academy_progress from anon, authenticated;

grant select on public.academy_articles to anon, authenticated;
grant select on public.academy_progress to authenticated;

grant select, insert, update, delete on public.academy_articles to service_role;
grant select, insert, update, delete on public.academy_progress to service_role;

create policy "academy_articles_public_published_select"
on public.academy_articles
for select
to anon, authenticated
using (status = 'published');

create policy "academy_progress_select_own"
on public.academy_progress
for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.publish_academy_article(p_article_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_article public.academy_articles%rowtype;
begin
  select *
  into target_article
  from public.academy_articles
  where id = p_article_id
  for update;

  if not found then
    raise exception 'Academy article not found';
  end if;

  if target_article.status <> 'reviewed' then
    raise exception 'Academy article must be reviewed before publication';
  end if;

  update public.academy_articles
  set
    status = 'superseded',
    updated_at = now()
  where content_key = target_article.content_key
    and status = 'published'
    and id <> target_article.id;

  update public.academy_articles
  set
    status = 'published',
    published_at = coalesce(published_at, now()),
    updated_at = now()
  where id = target_article.id;
end;
$$;

revoke execute on function public.publish_academy_article(uuid) from public;
revoke execute on function public.publish_academy_article(uuid) from anon;
revoke execute on function public.publish_academy_article(uuid) from authenticated;
grant execute on function public.publish_academy_article(uuid) to service_role;
