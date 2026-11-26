begin;

create or replace function public.get_association_fee_records_for_student(
  p_session_token text,
  p_student_id text,
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
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_student_id is null or nullif(btrim(p_student_id), '') is null or length(btrim(p_student_id)) > 100 then
    raise exception using errcode = '22023', message = 'invalid_student_id';
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
    and btrim(i.student_id) = btrim(p_student_id)
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
end;
$$;

revoke all privileges on function public.get_association_fee_records_for_student(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.get_association_fee_records_for_student(text, text, integer, integer)
  to anon;

notify pgrst, 'reload schema';

commit;
