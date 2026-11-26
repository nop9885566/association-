begin;

drop function if exists public.search_association_members(text, text, integer, integer);
drop function if exists public.search_association_members(text, text, text, integer, integer);

create function public.search_association_members(
  p_session_token text,
  p_search text,
  p_classroom text,
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
  with source_students as (
    select
      btrim(s.student_id::text) as student_id,
      count(*)::bigint as source_matches,
      min(nullif(btrim(s.grade::text), '')) as source_classroom
    from public.student as s
    where nullif(btrim(s.student_id::text), '') is not null
    group by btrim(s.student_id::text)
  ),
  directory_members as (
    select
      m.id,
      m.family_id,
      m.student_id,
      m.father_name,
      m.mother_name,
      m.guardian_name,
      m.child_name,
      coalesce(
        nullif(btrim(m.classroom), ''),
        case when s.source_matches = 1 then s.source_classroom else '' end,
        ''
      ) as classroom,
      m.is_active,
      exists (
        select 1
        from public.association_fee_student_items as i
        where i.student_id = m.student_id
      ) as has_fee_records,
      m.created_at
    from public.association_members as m
    left join source_students as s
      on s.student_id = btrim(m.student_id::text)
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
        or coalesce(
          nullif(btrim(m.classroom), ''),
          case when s.source_matches = 1 then s.source_classroom else '' end,
          ''
        ) ilike '%' || btrim(p_search) || '%'
      )
  ),
  filtered_members as (
    select d.*
    from directory_members as d
    where nullif(btrim(coalesce(p_classroom, '')), '') is null
      or case btrim(p_classroom)
        when 'อ.1' then d.classroom ~ '^อ[.]1(/[0-9]+)?$'
        when 'อ.2' then d.classroom ~ '^อ[.]2(/[0-9]+)?$'
        when 'อ.3' then d.classroom ~ '^อ[.]3(/[0-9]+)?$'
        when 'ป.1' then d.classroom ~ '^ป[.]1(/[0-9]+)?$'
        when 'ป.2' then d.classroom ~ '^ป[.]2(/[0-9]+)?$'
        when 'ป.3' then d.classroom ~ '^ป[.]3(/[0-9]+)?$'
        when 'ป.4' then d.classroom ~ '^ป[.]4(/[0-9]+)?$'
        when 'ป.5' then d.classroom ~ '^ป[.]5(/[0-9]+)?$'
        when 'ป.6' then d.classroom ~ '^ป[.]6(/[0-9]+)?$'
        else false
      end
  )
  select
    d.id,
    d.family_id,
    d.student_id,
    d.father_name,
    d.mother_name,
    d.guardian_name,
    d.child_name,
    d.classroom,
    d.is_active,
    d.has_fee_records,
    d.created_at
  from filtered_members as d
  order by
    case
      when d.classroom ~ '^อ[.]1(/[0-9]+)?$' then 1
      when d.classroom ~ '^อ[.]2(/[0-9]+)?$' then 2
      when d.classroom ~ '^อ[.]3(/[0-9]+)?$' then 3
      when d.classroom ~ '^ป[.]1(/[0-9]+)?$' then 4
      when d.classroom ~ '^ป[.]2(/[0-9]+)?$' then 5
      when d.classroom ~ '^ป[.]3(/[0-9]+)?$' then 6
      when d.classroom ~ '^ป[.]4(/[0-9]+)?$' then 7
      when d.classroom ~ '^ป[.]5(/[0-9]+)?$' then 8
      when d.classroom ~ '^ป[.]6(/[0-9]+)?$' then 9
      else 10
    end,
    case
      when d.classroom ~ '/[0-9]+$' then split_part(d.classroom, '/', 2)::numeric
      else 0
    end,
    d.child_name,
    d.student_id
  limit least(greatest(coalesce(p_limit, 50), 1), 101)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all privileges on function public.search_association_members(text, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.search_association_members(text, text, text, integer, integer) to anon;

notify pgrst, 'reload schema';

commit;
