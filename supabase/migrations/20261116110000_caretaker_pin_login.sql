begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.caretakers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.caretakers enable row level security;
revoke all privileges on table public.caretakers from anon, authenticated, public;

create or replace function public.list_caretakers_for_login()
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name
  from public.caretakers as c
  where c.is_active = true
  order by c.name, c.id;
$$;

create or replace function public.verify_caretaker_pin(p_caretaker_id uuid, p_pin text)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name
  from public.caretakers as c
  where c.id = p_caretaker_id
    and c.is_active = true
    and p_pin ~ '^[0-9]{4,6}$'
    and c.pin_hash = extensions.crypt(p_pin, c.pin_hash)
  limit 1;
$$;

revoke all privileges on function public.list_caretakers_for_login() from public, anon, authenticated;
revoke all privileges on function public.verify_caretaker_pin(uuid, text) from public, anon, authenticated;
grant execute on function public.list_caretakers_for_login() to anon;
grant execute on function public.verify_caretaker_pin(uuid, text) to anon;

commit;
