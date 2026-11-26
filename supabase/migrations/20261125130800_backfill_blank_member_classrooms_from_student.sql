begin;

with source_students as (
  select
    btrim(s.student_id::text) as student_id,
    count(*)::bigint as source_matches,
    min(nullif(btrim(s.grade::text), '')) as source_classroom
  from public.student as s
  where nullif(btrim(s.student_id::text), '') is not null
  group by btrim(s.student_id::text)
)
update public.association_members as m
set classroom = s.source_classroom,
    updated_at = now()
from source_students as s
where s.student_id = btrim(m.student_id::text)
  and s.source_matches = 1
  and s.source_classroom is not null
  and nullif(btrim(m.classroom), '') is null;

commit;
