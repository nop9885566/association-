begin;

create or replace function public.get_association_member_promotion_preview(p_session_token text)
returns table (
  member_id uuid,
  student_id text,
  child_name text,
  registry_classroom text,
  source_classroom text,
  source_matches bigint,
  target_classroom text,
  action text
)
language plpgsql
stable
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
  members as (
    select
      m.id,
      btrim(m.student_id::text) as student_id,
      coalesce(m.child_name, '') as child_name,
      coalesce(nullif(btrim(m.classroom), ''), '') as registry_classroom,
      coalesce(s.source_classroom, '') as source_classroom,
      coalesce(s.source_matches, 0)::bigint as source_matches
    from public.association_members as m
    left join source_students as s
      on s.student_id = btrim(m.student_id::text)
    where m.is_active = true
  ),
  classified as (
    select
      m.*,
      case
        when m.source_matches = 0 then 'student_missing'
        when m.source_matches > 1 then 'duplicate_student'
        when m.source_classroom = '' then 'missing_class'
        when m.source_classroom ~ '^(อ[.]1|อ[.]2|อ[.]3|ป[.]1|ป[.]2|ป[.]3|ป[.]4|ป[.]5|ป[.]6)(/[0-9]+)?$'
          then case
            when m.source_classroom ~ '^อ[.]1' then regexp_replace(m.source_classroom, '^อ[.]1', 'อ.2')
            when m.source_classroom ~ '^อ[.]2' then regexp_replace(m.source_classroom, '^อ[.]2', 'อ.3')
            when m.source_classroom ~ '^อ[.]3' then regexp_replace(m.source_classroom, '^อ[.]3', 'ป.1')
            when m.source_classroom ~ '^ป[.]1' then regexp_replace(m.source_classroom, '^ป[.]1', 'ป.2')
            when m.source_classroom ~ '^ป[.]2' then regexp_replace(m.source_classroom, '^ป[.]2', 'ป.3')
            when m.source_classroom ~ '^ป[.]3' then regexp_replace(m.source_classroom, '^ป[.]3', 'ป.4')
            when m.source_classroom ~ '^ป[.]4' then regexp_replace(m.source_classroom, '^ป[.]4', 'ป.5')
            when m.source_classroom ~ '^ป[.]5' then regexp_replace(m.source_classroom, '^ป[.]5', 'ป.6')
            when m.source_classroom ~ '^ป[.]6' then 'จบการศึกษา'
          end
        else null
      end as target_classroom,
      case
        when m.source_matches = 0 then 'student_missing'
        when m.source_matches > 1 then 'duplicate_student'
        when m.source_classroom = '' then 'missing_class'
        when m.source_classroom ~ '^ป[.]6(/[0-9]+)?$' then 'graduate'
        when m.source_classroom ~ '^(อ[.]1|อ[.]2|อ[.]3|ป[.]1|ป[.]2|ป[.]3|ป[.]4|ป[.]5)(/[0-9]+)?$'
          then 'promote'
        else 'invalid_class'
      end as action
    from members as m
  )
  select
    c.id,
    c.student_id,
    c.child_name,
    c.registry_classroom,
    c.source_classroom,
    c.source_matches,
    c.target_classroom,
    c.action
  from classified as c
  order by c.id::text collate "C";
end;
$$;

drop function if exists public.promote_association_members(text);

create or replace function public.promote_association_members(
  p_session_token text,
  p_expected_preview_hash text
)
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
  v_actual_preview_hash text;
  v_promoted_count bigint;
  v_graduated_count bigint;
  v_skipped_count bigint;
begin
  if p_expected_preview_hash is null or p_expected_preview_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_preview_hash';
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

  lock table public.association_members, public.student in share row exclusive mode;

  select encode(
    extensions.digest(
      coalesce(
        string_agg(
          p.member_id::text || E'\t' ||
          p.student_id || E'\t' ||
          p.child_name || E'\t' ||
          p.registry_classroom || E'\t' ||
          p.source_classroom || E'\t' ||
          p.source_matches::text,
          E'\n' order by p.member_id::text collate "C"
        ),
        ''
      ),
      'sha256'
    ),
    'hex'
  )
  into v_actual_preview_hash
  from public.get_association_member_promotion_preview(p_session_token) as p;

  if v_actual_preview_hash is distinct from p_expected_preview_hash then
    raise exception using errcode = '40001', message = 'stale_promotion_preview';
  end if;

  select
    count(*) filter (where p.action = 'promote'),
    count(*) filter (where p.action = 'graduate'),
    count(*) filter (where p.action in (
      'student_missing', 'duplicate_student', 'missing_class', 'invalid_class'
    ))
  into v_promoted_count, v_graduated_count, v_skipped_count
  from public.get_association_member_promotion_preview(p_session_token) as p;

  with preview as (
    select *
    from public.get_association_member_promotion_preview(p_session_token)
  )
  update public.association_members as m
  set classroom = case when p.action = 'graduate' then p.source_classroom else p.target_classroom end,
      is_active = case when p.action = 'graduate' then false else m.is_active end,
      updated_at = now()
  from preview as p
  where m.id = p.member_id
    and m.is_active = true
    and p.action in ('promote', 'graduate');

  return query
  select v_promoted_count, v_graduated_count, v_skipped_count;
end;
$$;

revoke all privileges on function public.get_association_member_promotion_preview(text) from public, authenticated;
grant execute on function public.get_association_member_promotion_preview(text) to anon;
revoke all privileges on function public.promote_association_members(text, text) from public, anon, authenticated;
grant execute on function public.promote_association_members(text, text) to anon;

notify pgrst, 'reload schema';

commit;
