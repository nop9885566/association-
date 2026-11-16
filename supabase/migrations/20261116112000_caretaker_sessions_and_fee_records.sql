begin;

create schema if not exists private;
revoke all privileges on schema private from public, anon, authenticated;

create table if not exists private.caretaker_sessions (
  token_hash text primary key,
  caretaker_id uuid not null references public.caretakers(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table private.caretaker_sessions enable row level security;
revoke all privileges on table private.caretaker_sessions from public, anon, authenticated;

drop function if exists public.verify_caretaker_pin(uuid, text);

create function public.verify_caretaker_pin(p_caretaker_id uuid, p_pin text)
returns table (id uuid, name text, session_token text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caretaker public.caretakers%rowtype;
  v_session_token text;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4,6}$' then
    return;
  end if;

  select c.*
  into v_caretaker
  from public.caretakers as c
  where c.id = p_caretaker_id
    and c.is_active = true
    and c.pin_hash = extensions.crypt(p_pin, c.pin_hash);

  if not found then
    return;
  end if;

  delete from private.caretaker_sessions as cs
  where cs.expires_at <= now();

  v_session_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.caretaker_sessions (token_hash, caretaker_id, expires_at)
  values (
    encode(extensions.digest(v_session_token, 'sha256'), 'hex'),
    v_caretaker.id,
    now() + interval '8 hours'
  );

  return query select v_caretaker.id, v_caretaker.name, v_session_token;
end;
$$;

create or replace function public.get_caretaker_session(p_session_token text)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name
  from private.caretaker_sessions as cs
  join public.caretakers as c on c.id = cs.caretaker_id
  where p_session_token ~ '^[0-9a-f]{64}$'
    and cs.token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    and cs.expires_at > now()
    and c.is_active = true;
$$;

create or replace function public.revoke_caretaker_session(p_session_token text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update private.caretaker_sessions as cs
  set expires_at = now()
  where p_session_token ~ '^[0-9a-f]{64}$'
    and cs.token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex');
$$;

create or replace function public.get_association_fee_records(
  p_session_token text,
  p_limit integer,
  p_offset integer
)
returns table (
  submission_id uuid,
  student_item_id uuid,
  student_id text,
  guardian_name text,
  submitted_amount numeric,
  payment_datetime timestamptz,
  status text,
  match_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.student_item_id,
    i.student_id,
    s.submitted_by_name,
    s.submitted_amount,
    s.payment_datetime,
    s.status,
    case
      when i.id is null then 'student_item_missing'
      when nullif(btrim(i.student_id), '') is null then 'student_id_missing'
      when nullif(btrim(s.submitted_by_name), '') is null then 'guardian_name_missing'
      else 'matched'
    end
  from public.association_fee_payment_submissions as s
  left join public.association_fee_student_items as i
    on i.id = s.student_item_id
  where s.is_latest = true
    and exists (
      select 1
      from private.caretaker_sessions as cs
      join public.caretakers as c on c.id = cs.caretaker_id
      where p_session_token ~ '^[0-9a-f]{64}$'
        and cs.token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
        and cs.expires_at > now()
        and c.is_active = true
    )
  order by s.created_at desc, s.id
  limit least(greatest(coalesce(p_limit, 50), 1), 101)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all privileges on function public.verify_caretaker_pin(uuid, text) from public, anon, authenticated;
revoke all privileges on function public.get_caretaker_session(text) from public, anon, authenticated;
revoke all privileges on function public.revoke_caretaker_session(text) from public, anon, authenticated;
revoke all privileges on function public.get_association_fee_records(text, integer, integer) from public, anon, authenticated;

grant execute on function public.verify_caretaker_pin(uuid, text) to anon;
grant execute on function public.get_caretaker_session(text) to anon;
grant execute on function public.revoke_caretaker_session(text) to anon;
grant execute on function public.get_association_fee_records(text, integer, integer) to anon;

notify pgrst, 'reload schema';

commit;
