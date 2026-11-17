begin;

create or replace function public.search_association_members(
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
    and (
      nullif(btrim(coalesce(p_search, '')), '') is null
      or m.child_name ilike '%' || btrim(p_search) || '%'
      or m.student_id ilike '%' || btrim(p_search) || '%'
      or m.father_name ilike '%' || btrim(p_search) || '%'
      or m.mother_name ilike '%' || btrim(p_search) || '%'
      or m.guardian_name ilike '%' || btrim(p_search) || '%'
    )
  order by m.child_name, m.student_id
  limit least(greatest(coalesce(p_limit, 50), 1), 101)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all privileges on function public.search_association_members(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.search_association_members(text, text, integer, integer) to anon;

notify pgrst, 'reload schema';

commit;
