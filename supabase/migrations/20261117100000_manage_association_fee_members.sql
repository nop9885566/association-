begin;

alter table public.association_fee_student_items
  add column if not exists member_name text not null default '',
  add column if not exists contact_info text not null default '';

update public.association_fee_student_items
set contact_info = ''
where contact_info is null;

alter table public.association_fee_student_items
  alter column contact_info set default '',
  alter column contact_info set not null;

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
    i.member_name,
    i.contact_info,
    i.amount,
    i.status,
    i.note,
    i.created_at
  from public.association_fee_student_items as i
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

create or replace function public.get_association_fee_member_cycles(p_session_token text)
returns table (cycle_id uuid, member_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select i.cycle_id, count(*)
  from public.association_fee_student_items as i
  where exists (
    select 1
    from private.caretaker_sessions as cs
    join public.caretakers as c on c.id = cs.caretaker_id
    where p_session_token ~ '^[0-9a-f]{64}$'
      and cs.token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
      and cs.expires_at > now()
      and c.is_active = true
  )
  group by i.cycle_id
  order by i.cycle_id;
$$;

create or replace function public.create_association_fee_member(
  p_session_token text,
  p_cycle_id uuid,
  p_student_id text,
  p_member_name text,
  p_contact_info text,
  p_amount numeric,
  p_note text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caretaker_id uuid;
  v_caretaker_name text;
  v_member_id uuid;
begin
  select c.id, c.name
  into v_caretaker_id, v_caretaker_name
  from private.caretaker_sessions as cs
  join public.caretakers as c on c.id = cs.caretaker_id
  where p_session_token ~ '^[0-9a-f]{64}$'
    and cs.token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    and cs.expires_at > now()
    and c.is_active = true;

  if not found then
    raise exception using errcode = '28000', message = 'invalid_session';
  end if;

  if p_cycle_id is null
    or nullif(btrim(p_student_id), '') is null
    or length(btrim(p_student_id)) > 100
    or nullif(btrim(p_member_name), '') is null
    or length(btrim(p_member_name)) > 200
    or length(coalesce(p_contact_info, '')) > 200
    or p_amount is null
    or p_amount <= 0
    or p_amount > 9999999999.99
    or p_amount <> round(p_amount, 2)
    or length(coalesce(p_note, '')) > 1000 then
    raise exception using errcode = '22023', message = 'invalid_member_data';
  end if;

  insert into public.association_fee_student_items (
    id, cycle_id, student_id, member_name, contact_info, amount,
    currency_code, status, note, created_by_name, updated_by_name
  )
  values (
    extensions.gen_random_uuid(),
    p_cycle_id,
    btrim(p_student_id),
    btrim(p_member_name),
    btrim(coalesce(p_contact_info, '')),
    p_amount,
    'THB',
    'pending',
    nullif(btrim(coalesce(p_note, '')), ''),
    v_caretaker_name,
    v_caretaker_name
  )
  returning id into v_member_id;

  return v_member_id;
end;
$$;

create or replace function public.update_association_fee_member(
  p_session_token text,
  p_member_id uuid,
  p_cycle_id uuid,
  p_student_id text,
  p_member_name text,
  p_contact_info text,
  p_amount numeric,
  p_note text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caretaker_name text;
begin
  select c.name
  into v_caretaker_name
  from private.caretaker_sessions as cs
  join public.caretakers as c on c.id = cs.caretaker_id
  where p_session_token ~ '^[0-9a-f]{64}$'
    and cs.token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    and cs.expires_at > now()
    and c.is_active = true;

  if not found then
    raise exception using errcode = '28000', message = 'invalid_session';
  end if;

  if p_member_id is null
    or p_cycle_id is null
    or nullif(btrim(p_student_id), '') is null
    or length(btrim(p_student_id)) > 100
    or nullif(btrim(p_member_name), '') is null
    or length(btrim(p_member_name)) > 200
    or length(coalesce(p_contact_info, '')) > 200
    or p_amount is null
    or p_amount <= 0
    or p_amount > 9999999999.99
    or p_amount <> round(p_amount, 2)
    or length(coalesce(p_note, '')) > 1000 then
    raise exception using errcode = '22023', message = 'invalid_member_data';
  end if;

  update public.association_fee_student_items as i
  set cycle_id = p_cycle_id,
      student_id = btrim(p_student_id),
      member_name = btrim(p_member_name),
      contact_info = btrim(coalesce(p_contact_info, '')),
      amount = p_amount,
      note = nullif(btrim(coalesce(p_note, '')), ''),
      updated_at = now(),
      updated_by_name = v_caretaker_name
  where i.id = p_member_id;

  return found;
end;
$$;

create or replace function public.delete_association_fee_member(
  p_session_token text,
  p_member_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
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

  if exists (
    select 1
    from public.association_fee_payment_submissions as s
    where s.student_item_id = p_member_id
  ) then
    raise exception using errcode = '23503', message = 'member_has_payment_history';
  end if;

  delete from public.association_fee_student_items as i
  where i.id = p_member_id;

  return found;
end;
$$;

revoke all privileges on function public.get_association_fee_members(text, integer, integer) from public, anon, authenticated;
revoke all privileges on function public.get_association_fee_member_cycles(text) from public, anon, authenticated;
revoke all privileges on function public.create_association_fee_member(text, uuid, text, text, text, numeric, text) from public, anon, authenticated;
revoke all privileges on function public.update_association_fee_member(text, uuid, uuid, text, text, text, numeric, text) from public, anon, authenticated;
revoke all privileges on function public.delete_association_fee_member(text, uuid) from public, anon, authenticated;

grant execute on function public.get_association_fee_members(text, integer, integer) to anon;
grant execute on function public.get_association_fee_member_cycles(text) to anon;
grant execute on function public.create_association_fee_member(text, uuid, text, text, text, numeric, text) to anon;
grant execute on function public.update_association_fee_member(text, uuid, uuid, text, text, text, numeric, text) to anon;
grant execute on function public.delete_association_fee_member(text, uuid) to anon;

notify pgrst, 'reload schema';

commit;
