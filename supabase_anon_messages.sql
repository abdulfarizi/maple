-- Maple ID · anonymous messages (text + drawing). Run once in Supabase → SQL Editor.
create table if not exists public.anon_messages (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 500),
  drawing text not null default '' check (char_length(drawing) <= 60000 and (drawing = '' or drawing like 'data:image/%')),
  created_at timestamptz not null default now(),
  check (char_length(body) > 0 or char_length(drawing) > 0)
);
create index if not exists anon_messages_owner_idx on public.anon_messages (owner, created_at desc);

-- counts recent messages for a card (security definer so visitors can't read the table)
create or replace function public.msg_recent(o uuid) returns int
language sql stable security definer set search_path = public as
$$ select count(*)::int from public.anon_messages where owner = o and created_at > now() - interval '1 minute' $$;

alter table public.anon_messages enable row level security;
grant insert on public.anon_messages to anon, authenticated;
grant select, delete on public.anon_messages to authenticated;

drop policy if exists "anyone can send" on public.anon_messages;
create policy "anyone can send" on public.anon_messages for insert to anon, authenticated
  with check (public.msg_recent(owner) < 20);           -- max 20 messages per card per minute
drop policy if exists "owner reads" on public.anon_messages;
create policy "owner reads" on public.anon_messages for select to authenticated using (auth.uid() = owner);
drop policy if exists "owner deletes" on public.anon_messages;
create policy "owner deletes" on public.anon_messages for delete to authenticated using (auth.uid() = owner);
