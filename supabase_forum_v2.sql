-- Maple ID · Forum part 2: reports, pinned posts, notifications, private messages.
-- Run AFTER supabase_forum.sql. Safe to run more than once.

-- ---- pinned posts (only your "maple" account can pin) ----
alter table public.forum_posts add column if not exists pinned boolean not null default false;
revoke update on public.forum_posts from authenticated;
grant update (pinned) on public.forum_posts to authenticated;
drop policy if exists "mod pins" on public.forum_posts;
create policy "mod pins" on public.forum_posts for update to authenticated using (public.forum_is_mod()) with check (public.forum_is_mod());

-- ---- likes remember who liked (for notifications) ----
alter table public.forum_likes add column if not exists user_name text not null default '';
alter table public.forum_likes add column if not exists user_slug text not null default '';

-- ---- reports ----
create table if not exists public.forum_reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('post','comment')),
  target uuid not null,
  post uuid,
  reporter uuid not null,
  reason text not null default '' check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  unique (kind, target, reporter)
);
create or replace function public.forum_recent_reports(u uuid) returns int
language sql stable security definer set search_path = public as
$$ select count(*)::int from public.forum_reports where reporter = u and created_at > now() - interval '10 minutes' $$;
alter table public.forum_reports enable row level security;
grant select, insert, delete on public.forum_reports to authenticated;
drop policy if exists "members report" on public.forum_reports;
create policy "members report" on public.forum_reports for insert to authenticated
  with check (reporter = auth.uid() and public.forum_recent_reports(auth.uid()) < 20);
drop policy if exists "mod reads reports" on public.forum_reports;
create policy "mod reads reports" on public.forum_reports for select to authenticated using (public.forum_is_mod());
drop policy if exists "mod clears reports" on public.forum_reports;
create policy "mod clears reports" on public.forum_reports for delete to authenticated using (public.forum_is_mod());

-- ---- notifications (created by triggers, so nobody can fake them) ----
create table if not exists public.forum_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null check (kind in ('like','comment')),
  post uuid references public.forum_posts(id) on delete cascade,
  post_title text not null default '',
  actor_name text not null default '',
  actor_slug text not null default '',
  snippet text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists forum_notif_user_idx on public.forum_notifications (user_id, created_at desc);
alter table public.forum_notifications enable row level security;
revoke all on public.forum_notifications from authenticated;
grant select, delete on public.forum_notifications to authenticated;
grant update (read) on public.forum_notifications to authenticated;
drop policy if exists "own notifications read" on public.forum_notifications;
create policy "own notifications read" on public.forum_notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "own notifications mark" on public.forum_notifications;
create policy "own notifications mark" on public.forum_notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own notifications delete" on public.forum_notifications;
create policy "own notifications delete" on public.forum_notifications for delete to authenticated using (user_id = auth.uid());

create or replace function public.forum_notify_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare o uuid; t text;
begin
  select author, title into o, t from public.forum_posts where id = new.post;
  if o is not null and o <> new.author then
    insert into public.forum_notifications (user_id, kind, post, post_title, actor_name, actor_slug, snippet)
    values (o, 'comment', new.post, left(t, 120), new.author_name, new.author_slug, left(new.body, 120));
  end if;
  return new;
end $$;
drop trigger if exists forum_comment_notify on public.forum_comments;
create trigger forum_comment_notify after insert on public.forum_comments for each row execute function public.forum_notify_comment();

create or replace function public.forum_notify_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare o uuid; t text;
begin
  select author, title into o, t from public.forum_posts where id = new.post;
  if o is not null and o <> new.user_id then
    insert into public.forum_notifications (user_id, kind, post, post_title, actor_name, actor_slug)
    values (o, 'like', new.post, left(t, 120), new.user_name, new.user_slug);
  end if;
  return new;
end $$;
drop trigger if exists forum_like_notify on public.forum_likes;
create trigger forum_like_notify after insert on public.forum_likes for each row execute function public.forum_notify_like();

-- ---- private messages ----
create table if not exists public.forum_dms (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null,
  sender_slug text not null default '' check (char_length(sender_slug) <= 40),
  sender_name text not null default '' check (char_length(sender_name) <= 80),
  recipient uuid not null,
  recipient_slug text not null default '' check (char_length(recipient_slug) <= 40),
  recipient_name text not null default '' check (char_length(recipient_name) <= 80),
  body text not null check (char_length(body) between 1 and 1000),
  read boolean not null default false,
  created_at timestamptz not null default now(),
  check (sender <> recipient)
);
create index if not exists forum_dms_rec_idx on public.forum_dms (recipient, created_at desc);
create index if not exists forum_dms_snd_idx on public.forum_dms (sender, created_at desc);
create or replace function public.forum_recent_dms(u uuid) returns int
language sql stable security definer set search_path = public as
$$ select count(*)::int from public.forum_dms where sender = u and created_at > now() - interval '10 minutes' $$;
alter table public.forum_dms enable row level security;
revoke all on public.forum_dms from authenticated;
grant select, insert, delete on public.forum_dms to authenticated;
grant update (read) on public.forum_dms to authenticated;
drop policy if exists "dm read" on public.forum_dms;
create policy "dm read" on public.forum_dms for select to authenticated using (sender = auth.uid() or recipient = auth.uid());
drop policy if exists "dm send" on public.forum_dms;
create policy "dm send" on public.forum_dms for insert to authenticated
  with check (sender = auth.uid() and public.forum_recent_dms(auth.uid()) < 20);                -- max 20 messages / 10 min
drop policy if exists "dm mark read" on public.forum_dms;
create policy "dm mark read" on public.forum_dms for update to authenticated using (recipient = auth.uid()) with check (recipient = auth.uid());
drop policy if exists "dm delete" on public.forum_dms;
create policy "dm delete" on public.forum_dms for delete to authenticated using (sender = auth.uid() or recipient = auth.uid());
