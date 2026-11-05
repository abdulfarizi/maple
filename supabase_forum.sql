-- Maple ID · Forum (home page for signed-in members). Run once in Supabase → SQL Editor.
create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  author uuid not null,
  author_slug text not null default '' check (char_length(author_slug) <= 40),
  author_name text not null default 'Member' check (char_length(author_name) <= 80),
  category text not null default 'general' check (category in ('general','gaming','showcase','help')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 2000),
  image text not null default '' check (char_length(image) <= 500 and (image = '' or image like 'https://%')),
  created_at timestamptz not null default now()
);
create index if not exists forum_posts_created_idx on public.forum_posts (created_at desc);
create index if not exists forum_posts_cat_idx on public.forum_posts (category, created_at desc);

create table if not exists public.forum_comments (
  id uuid primary key default gen_random_uuid(),
  post uuid not null references public.forum_posts(id) on delete cascade,
  author uuid not null,
  author_slug text not null default '' check (char_length(author_slug) <= 40),
  author_name text not null default 'Member' check (char_length(author_name) <= 80),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists forum_comments_post_idx on public.forum_comments (post, created_at);

create table if not exists public.forum_likes (
  post uuid not null references public.forum_posts(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (post, user_id)
);

-- helpers (security definer so the policies can look at the tables)
create or replace function public.forum_is_mod() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles where id = auth.uid() and slug = 'maple') $$;
create or replace function public.forum_recent_posts(u uuid) returns int
language sql stable security definer set search_path = public as
$$ select count(*)::int from public.forum_posts where author = u and created_at > now() - interval '10 minutes' $$;
create or replace function public.forum_recent_comments(u uuid) returns int
language sql stable security definer set search_path = public as
$$ select count(*)::int from public.forum_comments where author = u and created_at > now() - interval '10 minutes' $$;

alter table public.forum_posts enable row level security;
alter table public.forum_comments enable row level security;
alter table public.forum_likes enable row level security;
grant select, insert, delete on public.forum_posts, public.forum_comments, public.forum_likes to authenticated;

drop policy if exists "members read posts" on public.forum_posts;
create policy "members read posts" on public.forum_posts for select to authenticated using (true);
drop policy if exists "members post" on public.forum_posts;
create policy "members post" on public.forum_posts for insert to authenticated
  with check (author = auth.uid() and public.forum_recent_posts(auth.uid()) < 5);          -- max 5 posts / 10 min
drop policy if exists "delete own or mod" on public.forum_posts;
create policy "delete own or mod" on public.forum_posts for delete to authenticated using (author = auth.uid() or public.forum_is_mod());

drop policy if exists "members read comments" on public.forum_comments;
create policy "members read comments" on public.forum_comments for select to authenticated using (true);
drop policy if exists "members comment" on public.forum_comments;
create policy "members comment" on public.forum_comments for insert to authenticated
  with check (author = auth.uid() and public.forum_recent_comments(auth.uid()) < 15);     -- max 15 comments / 10 min
drop policy if exists "delete own comment or mod" on public.forum_comments;
create policy "delete own comment or mod" on public.forum_comments for delete to authenticated using (author = auth.uid() or public.forum_is_mod());

drop policy if exists "members read likes" on public.forum_likes;
create policy "members read likes" on public.forum_likes for select to authenticated using (true);
drop policy if exists "members like" on public.forum_likes;
create policy "members like" on public.forum_likes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "members unlike" on public.forum_likes;
create policy "members unlike" on public.forum_likes for delete to authenticated using (user_id = auth.uid());
