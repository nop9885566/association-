begin;

update public.association_members as m
set classroom = btrim(s.grade::text),
    updated_at = now()
from public.itpc_students_rows as s
where s.student_id::text = m.student_id
  and btrim(m.classroom) = ''
  and nullif(btrim(s.grade::text), '') is not null;

create or replace function public.promote_association_members(p_session_token text)
returns table (
  promoted_count bigint,
  graduated_count bigint,
  skipped_count bigint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_active_count bigint;
  v_recognized_count bigint;
  v_promoted_count bigint;
  v_graduated_count bigint;
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

  lock table public.association_members in share row exclusive mode;

  select count(*)
  into v_active_count
  from public.association_members as m
  where m.is_active;

  select count(*)
  into v_recognized_count
  from public.association_members as m
  where m.is_active
    and m.classroom ~ '^(อ[.]1|อ[.]2|อ[.]3|ป[.]1|ป[.]2|ป[.]3|ป[.]4|ป[.]5|ป[.]6)(/[0-9]+)?$';

  update public.association_members as m
  set classroom = case
        when m.classroom ~ '^อ[.]1' then regexp_replace(m.classroom, '^อ[.]1', 'อ.2')
        when m.classroom ~ '^อ[.]2' then regexp_replace(m.classroom, '^อ[.]2', 'อ.3')
        when m.classroom ~ '^อ[.]3' then regexp_replace(m.classroom, '^อ[.]3', 'ป.1')
        when m.classroom ~ '^ป[.]1' then regexp_replace(m.classroom, '^ป[.]1', 'ป.2')
        when m.classroom ~ '^ป[.]2' then regexp_replace(m.classroom, '^ป[.]2', 'ป.3')
        when m.classroom ~ '^ป[.]3' then regexp_replace(m.classroom, '^ป[.]3', 'ป.4')
        when m.classroom ~ '^ป[.]4' then regexp_replace(m.classroom, '^ป[.]4', 'ป.5')
        when m.classroom ~ '^ป[.]5' then regexp_replace(m.classroom, '^ป[.]5', 'ป.6')
      end,
      updated_at = now()
  where m.is_active
    and m.classroom ~ '^(อ[.]1|อ[.]2|อ[.]3|ป[.]1|ป[.]2|ป[.]3|ป[.]4|ป[.]5)(/[0-9]+)?$';
  get diagnostics v_promoted_count = row_count;

  update public.association_members as m
  set is_active = false,
      updated_at = now()
  where m.is_active
    and m.classroom ~ '^ป[.]6(/[0-9]+)?$';
  get diagnostics v_graduated_count = row_count;

  return query
  select
    v_promoted_count,
    v_graduated_count,
    v_active_count - v_recognized_count;
end;
$$;

revoke all privileges on function public.promote_association_members(text) from public, anon, authenticated;
grant execute on function public.promote_association_members(text) to anon;

notify pgrst, 'reload schema';

commit;
