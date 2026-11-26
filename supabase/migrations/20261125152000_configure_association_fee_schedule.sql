begin;

create table if not exists public.association_fee_schedules (
  academic_year integer primary key check (academic_year between 2500 and 2700),
  membership_amount numeric(12, 2) not null check (membership_amount >= 0),
  semester_1_amount numeric(12, 2) not null check (semester_1_amount >= 0),
  semester_2_amount numeric(12, 2) not null check (semester_2_amount >= 0),
  membership_opens_on date,
  membership_due_on date,
  semester_1_opens_on date,
  semester_1_due_on date,
  semester_2_opens_on date,
  semester_2_due_on date,
  updated_by_caretaker_id uuid not null,
  updated_at timestamptz not null default now(),
  check (membership_due_on is null or membership_opens_on is not null and membership_due_on >= membership_opens_on),
  check ((membership_opens_on is null) = (membership_due_on is null)),
  check (semester_1_due_on is null or semester_1_opens_on is not null and semester_1_due_on >= semester_1_opens_on),
  check ((semester_1_opens_on is null) = (semester_1_due_on is null)),
  check (semester_2_due_on is null or semester_2_opens_on is not null and semester_2_due_on >= semester_2_opens_on),
  check ((semester_2_opens_on is null) = (semester_2_due_on is null))
);

alter table public.association_fee_schedules enable row level security;
revoke all privileges on table public.association_fee_schedules from anon, authenticated, public;

create or replace function public.get_association_fee_schedule(
  p_session_token text,
  p_academic_year integer
)
returns table (
  academic_year integer,
  membership_amount numeric,
  semester_1_amount numeric,
  semester_2_amount numeric,
  membership_opens_on date,
  membership_due_on date,
  semester_1_opens_on date,
  semester_1_due_on date,
  semester_2_opens_on date,
  semester_2_due_on date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_academic_year is null or p_academic_year not between 2500 and 2700 then
    raise exception using errcode = '22023', message = 'invalid_academic_year';
  end if;

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

  return query
  select
    s.academic_year,
    s.membership_amount,
    s.semester_1_amount,
    s.semester_2_amount,
    s.membership_opens_on,
    s.membership_due_on,
    s.semester_1_opens_on,
    s.semester_1_due_on,
    s.semester_2_opens_on,
    s.semester_2_due_on
  from public.association_fee_schedules as s
  where s.academic_year = p_academic_year;
end;
$$;

create or replace function public.save_association_fee_schedule(
  p_session_token text,
  p_academic_year integer,
  p_membership_amount numeric,
  p_semester_1_amount numeric,
  p_semester_2_amount numeric,
  p_membership_opens_on date,
  p_membership_due_on date,
  p_semester_1_opens_on date,
  p_semester_1_due_on date,
  p_semester_2_opens_on date,
  p_semester_2_due_on date
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caretaker_id uuid;
begin
  if p_academic_year is null or p_academic_year not between 2500 and 2700
    or p_membership_amount is null or p_membership_amount < 0
    or p_semester_1_amount is null or p_semester_1_amount < 0
    or p_semester_2_amount is null or p_semester_2_amount < 0
    or (p_membership_opens_on is null) <> (p_membership_due_on is null)
    or (p_membership_opens_on is not null and p_membership_due_on < p_membership_opens_on)
    or (p_semester_1_opens_on is null) <> (p_semester_1_due_on is null)
    or (p_semester_1_opens_on is not null and p_semester_1_due_on < p_semester_1_opens_on)
    or (p_semester_2_opens_on is null) <> (p_semester_2_due_on is null)
    or (p_semester_2_opens_on is not null and p_semester_2_due_on < p_semester_2_opens_on) then
    raise exception using errcode = '22023', message = 'invalid_fee_schedule';
  end if;

  select cs.caretaker_id
  into v_caretaker_id
  from private.caretaker_sessions as cs
  join public.caretakers as c on c.id = cs.caretaker_id
  where p_session_token ~ '^[0-9a-f]{64}$'
    and cs.token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    and cs.expires_at > now()
    and c.is_active = true;

  if v_caretaker_id is null then
    raise exception using errcode = '28000', message = 'invalid_session';
  end if;

  insert into public.association_fee_schedules (
    academic_year,
    membership_amount,
    semester_1_amount,
    semester_2_amount,
    membership_opens_on,
    membership_due_on,
    semester_1_opens_on,
    semester_1_due_on,
    semester_2_opens_on,
    semester_2_due_on,
    updated_by_caretaker_id
  )
  values (
    p_academic_year,
    p_membership_amount,
    p_semester_1_amount,
    p_semester_2_amount,
    p_membership_opens_on,
    p_membership_due_on,
    p_semester_1_opens_on,
    p_semester_1_due_on,
    p_semester_2_opens_on,
    p_semester_2_due_on,
    v_caretaker_id
  )
  on conflict (academic_year) do update
  set membership_amount = excluded.membership_amount,
      semester_1_amount = excluded.semester_1_amount,
      semester_2_amount = excluded.semester_2_amount,
      membership_opens_on = excluded.membership_opens_on,
      membership_due_on = excluded.membership_due_on,
      semester_1_opens_on = excluded.semester_1_opens_on,
      semester_1_due_on = excluded.semester_1_due_on,
      semester_2_opens_on = excluded.semester_2_opens_on,
      semester_2_due_on = excluded.semester_2_due_on,
      updated_by_caretaker_id = excluded.updated_by_caretaker_id,
      updated_at = now();

  return true;
end;
$$;

revoke all privileges on function public.get_association_fee_schedule(text, integer)
  from public, anon, authenticated;
revoke all privileges on function public.save_association_fee_schedule(text, integer, numeric, numeric, numeric, date, date, date, date, date, date)
  from public, anon, authenticated;
grant execute on function public.get_association_fee_schedule(text, integer) to anon;
grant execute on function public.save_association_fee_schedule(text, integer, numeric, numeric, numeric, date, date, date, date, date, date)
  to anon;

notify pgrst, 'reload schema';

commit;
