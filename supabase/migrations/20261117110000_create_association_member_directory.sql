begin;

create table if not exists public.association_members (
  id uuid primary key default extensions.gen_random_uuid(),
  family_id uuid not null,
  student_id text not null unique,
  father_name text not null default '',
  mother_name text not null default '',
  guardian_name text not null default '',
  child_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint association_members_student_id_not_blank check (length(btrim(student_id)) > 0),
  constraint association_members_child_name_not_blank check (length(btrim(child_name)) > 0)
);

create index if not exists association_members_family_id_idx
  on public.association_members (family_id);
create index if not exists association_members_child_name_idx
  on public.association_members (child_name);

alter table public.association_members enable row level security;
revoke all privileges on table public.association_members from public, anon, authenticated;

create or replace function public.get_association_members(
  p_session_token text,
  p_limit integer,
  p_offset integer
)
returns table (
  id uuid,
  family_id uuid,
  student_id text,
  father_name text,
  mother_name text,
  guardian_name text,
  child_name text,
  is_active boolean,
  has_fee_records boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id,
    m.family_id,
    m.student_id,
    m.father_name,
    m.mother_name,
    m.guardian_name,
    m.child_name,
    m.is_active,
    exists (
      select 1
      from public.association_fee_student_items as i
      where i.student_id = m.student_id
    ),
    m.created_at
  from public.association_members as m
  where exists (
    select 1
    from private.caretaker_sessions as cs
    join public.caretakers as c on c.id = cs.caretaker_id
    where p_session_token ~ '^[0-9a-f]{64}$'
      and cs.token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
      and cs.expires_at > now()
      and c.is_active = true
  )
  order by m.child_name, m.student_id
  limit least(greatest(coalesce(p_limit, 50), 1), 101)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.get_association_member_families(p_session_token text)
returns table (family_id uuid, member_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select m.family_id, count(*)
  from public.association_members as m
  where exists (
    select 1
    from private.caretaker_sessions as cs
    join public.caretakers as c on c.id = cs.caretaker_id
    where p_session_token ~ '^[0-9a-f]{64}$'
      and cs.token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
      and cs.expires_at > now()
      and c.is_active = true
  )
  group by m.family_id
  order by m.family_id;
$$;

create or replace function public.create_association_member(
  p_session_token text,
  p_family_id uuid,
  p_student_id text,
  p_father_name text,
  p_mother_name text,
  p_guardian_name text,
  p_child_name text,
  p_is_active boolean
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  if not exists (
    select 1
    from private.caretaker_sessions as cs
    join public.caretakers as c on c.id = cs.caretaker_id
    where p_session_token ~ '^[0-9a-f]{64}$'
      and cs.token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
      and cs.expires_at > now()
      and c.is_active = true
  ) then
    raise exception using errcode = '28000', message = 'invalid_session';
  end if;

  if p_family_id is null
    or nullif(btrim(p_student_id), '') is null
    or length(btrim(p_student_id)) > 100
    or nullif(btrim(p_child_name), '') is null
    or length(btrim(p_child_name)) > 200
    or length(coalesce(p_father_name, '')) > 200
    or length(coalesce(p_mother_name, '')) > 200
    or length(coalesce(p_guardian_name, '')) > 200
    or p_is_active is null then
    raise exception using errcode = '22023', message = 'invalid_member_data';
  end if;

  if exists (
    select 1 from public.association_members as m
    where m.student_id = btrim(p_student_id)
  ) then
    raise exception using errcode = '23505', message = 'student_id_exists';
  end if;

  insert into public.association_members (
    family_id, student_id, father_name, mother_name, guardian_name, child_name, is_active
  )
  values (
    p_family_id,
    btrim(p_student_id),
    btrim(coalesce(p_father_name, '')),
    btrim(coalesce(p_mother_name, '')),
    btrim(coalesce(p_guardian_name, '')),
    btrim(p_child_name),
    p_is_active
  )
  returning id into v_member_id;

  return v_member_id;
end;
$$;

create or replace function public.update_association_member(
  p_session_token text,
  p_member_id uuid,
  p_family_id uuid,
  p_student_id text,
  p_father_name text,
  p_mother_name text,
  p_guardian_name text,
  p_child_name text,
  p_is_active boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_existing_student_id text;
begin
  if not exists (
    select 1
    from private.caretaker_sessions as cs
    join public.caretakers as c on c.id = cs.caretaker_id
    where p_session_token ~ '^[0-9a-f]{64}$'
      and cs.token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
      and cs.expires_at > now()
      and c.is_active = true
  ) then
    raise exception using errcode = '28000', message = 'invalid_session';
  end if;

  if p_member_id is null
    or p_family_id is null
    or nullif(btrim(p_student_id), '') is null
    or length(btrim(p_student_id)) > 100
    or nullif(btrim(p_child_name), '') is null
    or length(btrim(p_child_name)) > 200
    or length(coalesce(p_father_name, '')) > 200
    or length(coalesce(p_mother_name, '')) > 200
    or length(coalesce(p_guardian_name, '')) > 200
    or p_is_active is null then
    raise exception using errcode = '22023', message = 'invalid_member_data';
  end if;

  select m.student_id into v_existing_student_id
  from public.association_members as m
  where m.id = p_member_id;
  if not found then
    return false;
  end if;

  if exists (
    select 1
    from public.association_members as m
    where m.student_id = btrim(p_student_id)
      and m.id <> p_member_id
  ) then
    raise exception using errcode = '23505', message = 'student_id_exists';
  end if;

  if btrim(p_student_id) <> v_existing_student_id and exists (
    select 1
    from public.association_fee_student_items as i
    where i.student_id = v_existing_student_id
  ) then
    raise exception using errcode = '23503', message = 'student_id_in_use';
  end if;

  update public.association_members as m
  set family_id = p_family_id,
      student_id = btrim(p_student_id),
      father_name = btrim(coalesce(p_father_name, '')),
      mother_name = btrim(coalesce(p_mother_name, '')),
      guardian_name = btrim(coalesce(p_guardian_name, '')),
      child_name = btrim(p_child_name),
      is_active = p_is_active,
      updated_at = now()
  where m.id = p_member_id;

  return found;
end;
$$;

create or replace function public.delete_association_member(
  p_session_token text,
  p_member_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_student_id text;
begin
  if not exists (
    select 1
    from private.caretaker_sessions as cs
    join public.caretakers as c on c.id = cs.caretaker_id
    where p_session_token ~ '^[0-9a-f]{64}$'
      and cs.token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
      and cs.expires_at > now()
      and c.is_active = true
  ) then
    raise exception using errcode = '28000', message = 'invalid_session';
  end if;

  if p_member_id is null then
    raise exception using errcode = '22023', message = 'invalid_member_data';
  end if;

  select m.student_id into v_student_id
  from public.association_members as m
  where m.id = p_member_id;
  if not found then
    return false;
  end if;

  if exists (
    select 1 from public.association_fee_student_items as i
    where i.student_id = v_student_id
  ) then
    raise exception using errcode = '23503', message = 'member_has_fee_records';
  end if;

  delete from public.association_members as m
  where m.id = p_member_id;

  return found;
end;
$$;

create or replace function public.get_association_fee_members(
  p_session_token text,
  p_limit integer,
  p_offset integer
)
returns table (
  id uuid,
  cycle_id uuid,
  student_id text,
  member_name text,
  contact_info text,
  amount numeric,
  status text,
  note text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id,
    i.cycle_id,
    i.student_id,
    coalesce(nullif(i.member_name, ''), m.child_name, ''),
    i.contact_info,
    i.amount,
    i.status,
    i.note,
    i.created_at
  from public.association_fee_student_items as i
  left join public.association_members as m on m.student_id = i.student_id
  where exists (
    select 1
    from private.caretaker_sessions as cs
    join public.caretakers as c on c.id = cs.caretaker_id
    where p_session_token ~ '^[0-9a-f]{64}$'
      and cs.token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
      and cs.expires_at > now()
      and c.is_active = true
  )
  order by i.created_at desc, i.id
  limit least(greatest(coalesce(p_limit, 50), 1), 101)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all privileges on function public.get_association_members(text, integer, integer) from public, anon, authenticated;
revoke all privileges on function public.get_association_member_families(text) from public, anon, authenticated;
revoke all privileges on function public.create_association_member(text, uuid, text, text, text, text, text, boolean) from public, anon, authenticated;
revoke all privileges on function public.update_association_member(text, uuid, uuid, text, text, text, text, text, boolean) from public, anon, authenticated;
revoke all privileges on function public.delete_association_member(text, uuid) from public, anon, authenticated;
revoke all privileges on function public.get_association_fee_members(text, integer, integer) from public, anon, authenticated;

grant execute on function public.get_association_members(text, integer, integer) to anon;
grant execute on function public.get_association_member_families(text) to anon;
grant execute on function public.create_association_member(text, uuid, text, text, text, text, text, boolean) to anon;
grant execute on function public.update_association_member(text, uuid, uuid, text, text, text, text, text, boolean) to anon;
grant execute on function public.delete_association_member(text, uuid) to anon;
grant execute on function public.get_association_fee_members(text, integer, integer) to anon;

notify pgrst, 'reload schema';

commit;
