begin;

create or replace function public.get_duplicate_fee_submissions(p_session_token text)
returns table (
  student_item_id uuid,
  student_id text,
  guardian_names text[],
  submission_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.student_item_id,
    i.student_id,
    coalesce(
      array_agg(distinct nullif(btrim(s.submitted_by_name), ''))
        filter (where nullif(btrim(s.submitted_by_name), '') is not null),
      array[]::text[]
    ),
    count(*)
  from public.association_fee_payment_submissions as s
  left join public.association_fee_student_items as i
    on i.id = s.student_item_id
  where exists (
    select 1
    from private.caretaker_sessions as cs
    join public.caretakers as c on c.id = cs.caretaker_id
    where p_session_token ~ '^[0-9a-f]{64}$'
      and cs.token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
      and cs.expires_at > now()
      and c.is_active = true
  )
  group by s.student_item_id, i.student_id
  having count(*) >= 2
  order by count(*) desc, s.student_item_id;
$$;

create or replace function public.get_duplicate_student_ids(p_session_token text)
returns table (
  cycle_id uuid,
  student_id text,
  item_count bigint,
  student_item_ids uuid[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.cycle_id,
    i.student_id,
    count(*),
    array_agg(i.id order by i.id)
  from public.association_fee_student_items as i
  where nullif(btrim(i.student_id), '') is not null
    and exists (
      select 1
      from private.caretaker_sessions as cs
      join public.caretakers as c on c.id = cs.caretaker_id
      where p_session_token ~ '^[0-9a-f]{64}$'
        and cs.token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
        and cs.expires_at > now()
        and c.is_active = true
    )
  group by i.cycle_id, i.student_id
  having count(*) >= 2
  order by count(*) desc, i.cycle_id, i.student_id;
$$;

revoke all privileges on function public.get_duplicate_fee_submissions(text) from public, anon, authenticated;
revoke all privileges on function public.get_duplicate_student_ids(text) from public, anon, authenticated;
grant execute on function public.get_duplicate_fee_submissions(text) to anon;
grant execute on function public.get_duplicate_student_ids(text) to anon;

notify pgrst, 'reload schema';

commit;
