begin;

alter table public.association_members
  add column if not exists classroom text not null default '';

alter table public.association_fee_student_items
  add column if not exists fee_type text,
  add column if not exists academic_year integer,
  add column if not exists semester smallint;

alter table public.association_fee_student_items
  drop constraint if exists association_fee_student_items_fee_period_check;

alter table public.association_fee_student_items
  add constraint association_fee_student_items_fee_period_check check (
    (fee_type is null and academic_year is null and semester is null)
    or (
      fee_type = 'membership'
      and academic_year between 2500 and 2700
      and semester is null
    )
    or (
      fee_type = 'tuition'
      and academic_year between 2500 and 2700
      and semester in (1, 2)
    )
  );

create index if not exists association_fee_student_items_fee_period_idx
  on public.association_fee_student_items (fee_type, academic_year, semester);

drop function if exists public.search_association_members(text, text, integer, integer);
create function public.search_association_members(
  p_session_token text,
  p_search text,
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
  classroom text,
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
    m.classroom,
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
    and (
      nullif(btrim(coalesce(p_search, '')), '') is null
      or m.child_name ilike '%' || btrim(p_search) || '%'
      or m.student_id ilike '%' || btrim(p_search) || '%'
      or m.father_name ilike '%' || btrim(p_search) || '%'
      or m.mother_name ilike '%' || btrim(p_search) || '%'
      or m.guardian_name ilike '%' || btrim(p_search) || '%'
      or m.classroom ilike '%' || btrim(p_search) || '%'
    )
  order by m.child_name, m.student_id
  limit least(greatest(coalesce(p_limit, 50), 1), 101)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

drop function if exists public.create_association_member(text, uuid, text, text, text, text, text, boolean);
create function public.create_association_member(
  p_session_token text,
  p_family_id uuid,
  p_student_id text,
  p_father_name text,
  p_mother_name text,
  p_guardian_name text,
  p_child_name text,
  p_classroom text,
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
    or length(coalesce(p_classroom, '')) > 100
    or p_is_active is null then
    raise exception using errcode = '22023', message = 'invalid_member_data';
  end if;

  insert into public.association_members (
    family_id, student_id, father_name, mother_name, guardian_name, child_name, classroom, is_active
  )
  values (
    p_family_id, btrim(p_student_id), btrim(coalesce(p_father_name, '')),
    btrim(coalesce(p_mother_name, '')), btrim(coalesce(p_guardian_name, '')),
    btrim(p_child_name), btrim(coalesce(p_classroom, '')), p_is_active
  )
  returning id into v_member_id;

  return v_member_id;
end;
$$;

drop function if exists public.update_association_member(text, uuid, uuid, text, text, text, text, text, boolean);
create function public.update_association_member(
  p_session_token text,
  p_member_id uuid,
  p_family_id uuid,
  p_student_id text,
  p_father_name text,
  p_mother_name text,
  p_guardian_name text,
  p_child_name text,
  p_classroom text,
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
    or length(coalesce(p_classroom, '')) > 100
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
    select 1 from public.association_members as m
    where m.student_id = btrim(p_student_id) and m.id <> p_member_id
  ) then
    raise exception using errcode = '23505', message = 'student_id_exists';
  end if;

  if btrim(p_student_id) <> v_existing_student_id and exists (
    select 1 from public.association_fee_student_items as i
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
      classroom = btrim(coalesce(p_classroom, '')),
      is_active = p_is_active,
      updated_at = now()
  where m.id = p_member_id;

  return found;
end;
$$;

drop function if exists public.get_association_fee_members(text, integer, integer);
drop function if exists public.get_association_fee_members(text, text, integer, integer);
create function public.get_association_fee_members(
  p_session_token text,
  p_status text,
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
  created_at timestamptz,
  fee_type text,
  academic_year integer,
  semester smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id, i.cycle_id, i.student_id,
    coalesce(nullif(i.member_name, ''), m.child_name, ''),
    i.contact_info, i.amount,
    case
      when exists (
        select 1 from public.association_fee_payment_submissions as s
        where s.student_item_id = i.id and s.is_latest and s.status = 'approved'
      ) then 'approved'
      when exists (
        select 1 from public.association_fee_payment_submissions as s
        where s.student_item_id = i.id and s.is_latest and s.status = 'waiting_for_review'
      ) then 'waiting_for_review'
      when exists (
        select 1 from public.association_fee_payment_submissions as s
        where s.student_item_id = i.id and s.is_latest and s.status = 'rejected'
      ) then 'rejected'
      else i.status
    end,
    i.note, i.created_at,
    i.fee_type, i.academic_year, i.semester
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
    and (
      p_status is null
      or (
        p_status = 'pending'
        and not exists (
          select 1 from public.association_fee_payment_submissions as s
          where s.student_item_id = i.id and s.is_latest and s.status = 'approved'
        )
      )
      or (p_status = 'submitted' and i.status = 'submitted')
    )
  order by i.created_at desc, i.id
  limit least(greatest(coalesce(p_limit, 50), 1), 101)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

drop function if exists public.create_association_fee_member(text, uuid, text, text, text, numeric, text);
create function public.create_association_fee_member(
  p_session_token text,
  p_cycle_id uuid,
  p_student_id text,
  p_member_name text,
  p_contact_info text,
  p_amount numeric,
  p_note text,
  p_fee_type text,
  p_academic_year integer,
  p_semester smallint
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caretaker_name text;
  v_member_id uuid;
begin
  select c.name into v_caretaker_name
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
    or p_amount is null or p_amount <= 0 or p_amount > 9999999999.99
    or p_amount <> round(p_amount, 2)
    or length(coalesce(p_note, '')) > 1000
    or p_fee_type is null
    or p_academic_year is null or p_academic_year not between 2500 and 2700
    or p_fee_type not in ('membership', 'tuition')
    or (p_fee_type = 'membership' and p_semester is not null)
    or (p_fee_type = 'tuition' and (p_semester is null or p_semester not in (1, 2))) then
    raise exception using errcode = '22023', message = 'invalid_member_data';
  end if;

  insert into public.association_fee_student_items (
    id, cycle_id, student_id, member_name, contact_info, amount,
    currency_code, status, note, created_by_name, updated_by_name,
    fee_type, academic_year, semester
  )
  values (
    extensions.gen_random_uuid(), p_cycle_id, btrim(p_student_id), btrim(p_member_name),
    btrim(coalesce(p_contact_info, '')), p_amount, 'THB', 'pending',
    nullif(btrim(coalesce(p_note, '')), ''), v_caretaker_name, v_caretaker_name,
    p_fee_type, p_academic_year, p_semester
  )
  returning id into v_member_id;
  return v_member_id;
end;
$$;

drop function if exists public.update_association_fee_member(text, uuid, uuid, text, text, text, numeric, text);
create function public.update_association_fee_member(
  p_session_token text,
  p_member_id uuid,
  p_cycle_id uuid,
  p_student_id text,
  p_member_name text,
  p_contact_info text,
  p_amount numeric,
  p_note text,
  p_fee_type text,
  p_academic_year integer,
  p_semester smallint
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
  select c.name into v_caretaker_name
  from private.caretaker_sessions as cs
  join public.caretakers as c on c.id = cs.caretaker_id
  where p_session_token ~ '^[0-9a-f]{64}$'
    and cs.token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    and cs.expires_at > now()
    and c.is_active = true;
  if not found then
    raise exception using errcode = '28000', message = 'invalid_session';
  end if;

  if p_member_id is null or p_cycle_id is null
    or nullif(btrim(p_student_id), '') is null or length(btrim(p_student_id)) > 100
    or nullif(btrim(p_member_name), '') is null or length(btrim(p_member_name)) > 200
    or length(coalesce(p_contact_info, '')) > 200
    or p_amount is null or p_amount <= 0 or p_amount > 9999999999.99
    or p_amount <> round(p_amount, 2)
    or length(coalesce(p_note, '')) > 1000
    or p_fee_type is null
    or p_academic_year is null or p_academic_year not between 2500 and 2700
    or p_fee_type not in ('membership', 'tuition')
    or (p_fee_type = 'membership' and p_semester is not null)
    or (p_fee_type = 'tuition' and (p_semester is null or p_semester not in (1, 2))) then
    raise exception using errcode = '22023', message = 'invalid_member_data';
  end if;

  update public.association_fee_student_items as i
  set cycle_id = p_cycle_id,
      student_id = btrim(p_student_id),
      member_name = btrim(p_member_name),
      contact_info = btrim(coalesce(p_contact_info, '')),
      amount = p_amount,
      note = nullif(btrim(coalesce(p_note, '')), ''),
      fee_type = p_fee_type,
      academic_year = p_academic_year,
      semester = p_semester,
      updated_at = now(),
      updated_by_name = v_caretaker_name
  where i.id = p_member_id;
  return found;
end;
$$;

create or replace function public.get_association_dashboard_summary(p_academic_year integer)
returns table (
  active_guardians bigint,
  active_families bigint,
  active_students bigint,
  membership_paid bigint,
  tuition_semester_1_paid bigint,
  tuition_semester_2_paid bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with active_guardians as (
    select m.family_id, nullif(btrim(m.father_name), '') as guardian_name
    from public.association_members as m
    where m.is_active
    union
    select m.family_id, nullif(btrim(m.mother_name), '')
    from public.association_members as m
    where m.is_active
    union
    select m.family_id, nullif(btrim(m.guardian_name), '')
    from public.association_members as m
    where m.is_active
  )
  select
    (select count(*) from active_guardians where guardian_name is not null),
    (select count(distinct m.family_id)
     from public.association_members as m where m.is_active),
    (select count(*) from public.association_members as m where m.is_active),
    (select count(distinct i.student_id)
     from public.association_fee_student_items as i
     join public.association_members as m on m.student_id = i.student_id and m.is_active
     where i.fee_type = 'membership' and i.academic_year = p_academic_year
       and exists (
         select 1 from public.association_fee_payment_submissions as s
         where s.student_item_id = i.id and s.is_latest and s.status = 'approved'
       )),
    (select count(distinct i.student_id)
     from public.association_fee_student_items as i
     join public.association_members as m on m.student_id = i.student_id and m.is_active
     where i.fee_type = 'tuition' and i.academic_year = p_academic_year and i.semester = 1
       and exists (
         select 1 from public.association_fee_payment_submissions as s
         where s.student_item_id = i.id and s.is_latest and s.status = 'approved'
       )),
    (select count(distinct i.student_id)
     from public.association_fee_student_items as i
     join public.association_members as m on m.student_id = i.student_id and m.is_active
     where i.fee_type = 'tuition' and i.academic_year = p_academic_year and i.semester = 2
       and exists (
         select 1 from public.association_fee_payment_submissions as s
         where s.student_item_id = i.id and s.is_latest and s.status = 'approved'
       ));
$$;

revoke all privileges on function public.search_association_members(text, text, integer, integer) from public, anon, authenticated;
revoke all privileges on function public.create_association_member(text, uuid, text, text, text, text, text, text, boolean) from public, anon, authenticated;
revoke all privileges on function public.update_association_member(text, uuid, uuid, text, text, text, text, text, text, boolean) from public, anon, authenticated;
revoke all privileges on function public.get_association_fee_members(text, text, integer, integer) from public, anon, authenticated;
revoke all privileges on function public.create_association_fee_member(text, uuid, text, text, text, numeric, text, text, integer, smallint) from public, anon, authenticated;
revoke all privileges on function public.update_association_fee_member(text, uuid, uuid, text, text, text, numeric, text, text, integer, smallint) from public, anon, authenticated;
revoke all privileges on function public.get_association_dashboard_summary(integer) from public, anon, authenticated;

grant execute on function public.search_association_members(text, text, integer, integer) to anon;
grant execute on function public.create_association_member(text, uuid, text, text, text, text, text, text, boolean) to anon;
grant execute on function public.update_association_member(text, uuid, uuid, text, text, text, text, text, text, boolean) to anon;
grant execute on function public.get_association_fee_members(text, text, integer, integer) to anon;
grant execute on function public.create_association_fee_member(text, uuid, text, text, text, numeric, text, text, integer, smallint) to anon;
grant execute on function public.update_association_fee_member(text, uuid, uuid, text, text, text, numeric, text, text, integer, smallint) to anon;
grant execute on function public.get_association_dashboard_summary(integer) to anon;

notify pgrst, 'reload schema';

commit;
