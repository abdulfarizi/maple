-- Maple ID · automatic card number (ID / 001, 002, ...)
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- New cards get the next number automatically (gap-free, race-safe). Existing cards are numbered by
-- the order their ACCOUNT was registered (auth.users.created_at); the "maple" owner card is always 001.

alter table public.profiles add column if not exists card_no integer;

-- 1) number the cards that exist today
with ranked as (
  select p.id,
         row_number() over (order by (p.slug = 'maple') desc, u.created_at asc nulls last, p.id) as rn
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.card_no is null
), base as (select coalesce(max(card_no), 0) as n from public.profiles)
update public.profiles p
set card_no = r.rn + b.n
from ranked r, base b
where p.id = r.id;

-- 2) every new card is numbered by the database (the browser can never choose or change it)
create or replace function public.assign_card_no() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(727001);
    new.card_no := case when new.slug = 'maple' then 1
                        else coalesce((select max(card_no) from public.profiles), 0) + 1 end;
  else
    new.card_no := old.card_no;           -- immutable after creation
  end if;
  return new;
end $$;

drop trigger if exists profiles_card_no on public.profiles;
create trigger profiles_card_no before insert or update on public.profiles
for each row execute function public.assign_card_no();

create unique index if not exists profiles_card_no_key on public.profiles (card_no);
