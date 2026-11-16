create extension if not exists pgcrypto;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{6}$'),
  owner_telegram_id bigint not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  telegram_id bigint not null,
  profile jsonb not null default '{}'::jsonb,
  joined_at timestamptz not null default now(),
  primary key (household_id, telegram_id),
  unique (telegram_id)
);

alter table public.households enable row level security;
alter table public.household_members enable row level security;

-- Клиент не обращается к таблицам напрямую. Edge Function после проверки
-- подписи Telegram использует service role и обходит RLS.
revoke all on public.households from anon, authenticated;
revoke all on public.household_members from anon, authenticated;

create or replace function public.touch_household() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists household_updated on public.households;
create trigger household_updated before update on public.households for each row execute function public.touch_household();

