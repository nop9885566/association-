begin;

create or replace function public.get_association_payment_tracking(
  p_session_token text,
  p_academic_year integer,
  p_search text,
  p_classroom text,
  p_limit integer,
  p_offset integer
)
returns table (
  student_id text,
  child_name text,
  classroom text,
  guardian_names text,
  membership_total numeric,
  membership_paid numeric,
  membership_item_count bigint,
  membership_waiting boolean,
  membership_rejected boolean,
  semester_1_total numeric,
  semester_1_paid numeric,
  semester_1_item_count bigint,
  semester_1_waiting boolean,
  semester_1_rejected boolean,
  semester_2_total numeric,
  semester_2_paid numeric,
  semester_2_item_count bigint,
  semester_2_waiting boolean,
  semester_2_rejected boolean
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
  with source_students as (
    select
      btrim(s.student_id::text) as student_id,
      count(*)::bigint as source_matches,
      min(nullif(btrim(s.grade::text), '')) as source_classroom
    from public.student as s
    where nullif(btrim(s.student_id::text), '') is not null
    group by btrim(s.student_id::text)
  ),
  active_members as (
    select
      m.student_id,
      m.child_name,
      coalesce(
        nullif(btrim(m.classroom), ''),
        case when s.source_matches = 1 then s.source_classroom else '' end,
        ''
      ) as classroom,
      coalesce(g.guardian_names, '') as guardian_names
    from public.association_members as m
    left join source_students as s
      on s.student_id = btrim(m.student_id)
    left join lateral (
      select string_agg(distinct n.name, ' / ' order by n.name) as guardian_names
      from (
        values
          (nullif(btrim(m.father_name), '')),
          (nullif(btrim(m.mother_name), '')),
          (nullif(btrim(m.guardian_name), ''))
      ) as n(name)
      where n.name is not null
    ) as g on true
    where m.is_active = true
  ),
  item_statuses as (
    select
      i.student_id,
      i.fee_type,
      i.semester,
      i.amount,
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
      end as payment_status
    from public.association_fee_student_items as i
    where i.academic_year = p_academic_year
      and (
        i.fee_type = 'membership'
        or (i.fee_type = 'tuition' and i.semester in (1, 2))
      )
  ),
  fee_totals as (
    select
      i.student_id,
      coalesce(sum(i.amount) filter (where i.fee_type = 'membership'), 0)::numeric as membership_total,
      coalesce(sum(i.amount) filter (where i.fee_type = 'membership' and i.payment_status = 'approved'), 0)::numeric as membership_paid,
      count(*) filter (where i.fee_type = 'membership')::bigint as membership_item_count,
      coalesce(bool_or(i.payment_status in ('submitted', 'waiting_for_review')) filter (where i.fee_type = 'membership'), false) as membership_waiting,
      coalesce(bool_or(i.payment_status = 'rejected') filter (where i.fee_type = 'membership'), false) as membership_rejected,
      coalesce(sum(i.amount) filter (where i.fee_type = 'tuition' and i.semester = 1), 0)::numeric as semester_1_total,
      coalesce(sum(i.amount) filter (where i.fee_type = 'tuition' and i.semester = 1 and i.payment_status = 'approved'), 0)::numeric as semester_1_paid,
      count(*) filter (where i.fee_type = 'tuition' and i.semester = 1)::bigint as semester_1_item_count,
      coalesce(bool_or(i.payment_status in ('submitted', 'waiting_for_review')) filter (where i.fee_type = 'tuition' and i.semester = 1), false) as semester_1_waiting,
      coalesce(bool_or(i.payment_status = 'rejected') filter (where i.fee_type = 'tuition' and i.semester = 1), false) as semester_1_rejected,
      coalesce(sum(i.amount) filter (where i.fee_type = 'tuition' and i.semester = 2), 0)::numeric as semester_2_total,
      coalesce(sum(i.amount) filter (where i.fee_type = 'tuition' and i.semester = 2 and i.payment_status = 'approved'), 0)::numeric as semester_2_paid,
      count(*) filter (where i.fee_type = 'tuition' and i.semester = 2)::bigint as semester_2_item_count,
      coalesce(bool_or(i.payment_status in ('submitted', 'waiting_for_review')) filter (where i.fee_type = 'tuition' and i.semester = 2), false) as semester_2_waiting,
      coalesce(bool_or(i.payment_status = 'rejected') filter (where i.fee_type = 'tuition' and i.semester = 2), false) as semester_2_rejected
    from item_statuses as i
    group by i.student_id
  ),
  report_rows as (
    select
      m.student_id,
      m.child_name,
      m.classroom,
      m.guardian_names,
      coalesce(f.membership_total, 0)::numeric as membership_total,
      coalesce(f.membership_paid, 0)::numeric as membership_paid,
      coalesce(f.membership_item_count, 0)::bigint as membership_item_count,
      coalesce(f.membership_waiting, false) as membership_waiting,
      coalesce(f.membership_rejected, false) as membership_rejected,
      coalesce(f.semester_1_total, 0)::numeric as semester_1_total,
      coalesce(f.semester_1_paid, 0)::numeric as semester_1_paid,
      coalesce(f.semester_1_item_count, 0)::bigint as semester_1_item_count,
      coalesce(f.semester_1_waiting, false) as semester_1_waiting,
      coalesce(f.semester_1_rejected, false) as semester_1_rejected,
      coalesce(f.semester_2_total, 0)::numeric as semester_2_total,
      coalesce(f.semester_2_paid, 0)::numeric as semester_2_paid,
      coalesce(f.semester_2_item_count, 0)::bigint as semester_2_item_count,
      coalesce(f.semester_2_waiting, false) as semester_2_waiting,
      coalesce(f.semester_2_rejected, false) as semester_2_rejected
    from active_members as m
    left join fee_totals as f on f.student_id = m.student_id
  )
  select
    r.student_id,
    r.child_name,
    r.classroom,
    r.guardian_names,
    r.membership_total,
    r.membership_paid,
    r.membership_item_count,
    r.membership_waiting,
    r.membership_rejected,
    r.semester_1_total,
    r.semester_1_paid,
    r.semester_1_item_count,
    r.semester_1_waiting,
    r.semester_1_rejected,
    r.semester_2_total,
    r.semester_2_paid,
    r.semester_2_item_count,
    r.semester_2_waiting,
    r.semester_2_rejected
  from report_rows as r
  where (
    nullif(btrim(coalesce(p_search, '')), '') is null
    or r.student_id ilike '%' || btrim(p_search) || '%'
    or r.child_name ilike '%' || btrim(p_search) || '%'
    or r.classroom ilike '%' || btrim(p_search) || '%'
    or r.guardian_names ilike '%' || btrim(p_search) || '%'
  )
    and (
      nullif(btrim(coalesce(p_classroom, '')), '') is null
      or case btrim(p_classroom)
        when 'อ.1' then r.classroom ~ '^อ[.]1(/[0-9]+)?$'
        when 'อ.2' then r.classroom ~ '^อ[.]2(/[0-9]+)?$'
        when 'อ.3' then r.classroom ~ '^อ[.]3(/[0-9]+)?$'
        when 'ป.1' then r.classroom ~ '^ป[.]1(/[0-9]+)?$'
        when 'ป.2' then r.classroom ~ '^ป[.]2(/[0-9]+)?$'
        when 'ป.3' then r.classroom ~ '^ป[.]3(/[0-9]+)?$'
        when 'ป.4' then r.classroom ~ '^ป[.]4(/[0-9]+)?$'
        when 'ป.5' then r.classroom ~ '^ป[.]5(/[0-9]+)?$'
        when 'ป.6' then r.classroom ~ '^ป[.]6(/[0-9]+)?$'
        else false
      end
    )
  order by
    case
      when r.classroom ~ '^อ[.]1(/[0-9]+)?$' then 1
      when r.classroom ~ '^อ[.]2(/[0-9]+)?$' then 2
      when r.classroom ~ '^อ[.]3(/[0-9]+)?$' then 3
      when r.classroom ~ '^ป[.]1(/[0-9]+)?$' then 4
      when r.classroom ~ '^ป[.]2(/[0-9]+)?$' then 5
      when r.classroom ~ '^ป[.]3(/[0-9]+)?$' then 6
      when r.classroom ~ '^ป[.]4(/[0-9]+)?$' then 7
      when r.classroom ~ '^ป[.]5(/[0-9]+)?$' then 8
      when r.classroom ~ '^ป[.]6(/[0-9]+)?$' then 9
      else 10
    end,
    case
      when r.classroom ~ '/[0-9]+$' then split_part(r.classroom, '/', 2)::numeric
      else 0
    end,
    r.child_name,
    r.student_id
  limit least(greatest(coalesce(p_limit, 50), 1), 1000)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all privileges on function public.get_association_payment_tracking(text, integer, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.get_association_payment_tracking(text, integer, text, text, integer, integer)
  to anon;

notify pgrst, 'reload schema';

commit;
