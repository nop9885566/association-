begin;

with active_guardians as (
  select
    g.family_id::text as family_id,
    g.relationship_type,
    upper(coalesce(g.is_primary::text, 'FALSE')) = 'TRUE' as is_primary,
    nullif(
      btrim(
        concat_ws(
          ' ',
          nullif(btrim(g.title_th), ''),
          nullif(btrim(g.first_name_th), ''),
          nullif(btrim(g.last_name_th), '')
        )
      ),
      ''
    ) as full_name
  from public.itpc_family_guardians_rows as g
  where upper(coalesce(g.is_active::text, 'FALSE')) = 'TRUE'
),
guardian_names as (
  select
    family_id,
    relationship_type,
    string_agg(distinct full_name, ' / ' order by full_name)
      filter (where is_primary and full_name is not null) as primary_names,
    string_agg(distinct full_name, ' / ' order by full_name)
      filter (where full_name is not null) as all_names
  from active_guardians
  group by family_id, relationship_type
),
family_names as (
  select
    family_id,
    coalesce(
      max(primary_names) filter (where relationship_type = 'father'),
      max(all_names) filter (where relationship_type = 'father'),
      ''
    ) as father_name,
    coalesce(
      max(primary_names) filter (where relationship_type = 'mother'),
      max(all_names) filter (where relationship_type = 'mother'),
      ''
    ) as mother_name,
    coalesce(
      max(primary_names) filter (where relationship_type = 'guardian'),
      max(all_names) filter (where relationship_type = 'guardian'),
      ''
    ) as guardian_name
  from guardian_names
  group by family_id
),
student_members as (
  select
    s.id::uuid as id,
    fs.family_id::uuid as family_id,
    s.student_id::text as student_id,
    coalesce(fn.father_name, '') as source_father_name,
    coalesce(fn.mother_name, '') as source_mother_name,
    coalesce(fn.guardian_name, '') as guardian_name,
    btrim(concat_ws(' ', nullif(btrim(s.first_name_th), ''), nullif(btrim(s.last_name_th), ''))) as child_name,
    upper(coalesce(fs.is_active::text, 'FALSE')) = 'TRUE'
      and upper(coalesce(s.is_active::text, 'FALSE')) = 'TRUE' as is_active
  from public.itpc_family_students_rows as fs
  join public.itpc_students_rows as s
    on s.id::text = fs.student_uuid::text
  left join family_names as fn
    on fn.family_id = fs.family_id::text
  where upper(coalesce(fs.is_active::text, 'FALSE')) = 'TRUE'
    and upper(coalesce(s.is_active::text, 'FALSE')) = 'TRUE'
)
insert into public.association_members (
  id,
  family_id,
  student_id,
  father_name,
  mother_name,
  guardian_name,
  child_name,
  is_active
)
select
  id,
  family_id,
  student_id,
  case
    when source_father_name = '' and source_mother_name <> '' then guardian_name
    else source_father_name
  end,
  case
    when source_mother_name = '' and source_father_name <> '' then guardian_name
    else source_mother_name
  end,
  guardian_name,
  child_name,
  is_active
from student_members
on conflict (student_id) do update
set family_id = excluded.family_id,
    father_name = excluded.father_name,
    mother_name = excluded.mother_name,
    guardian_name = excluded.guardian_name,
    child_name = excluded.child_name,
    is_active = excluded.is_active,
    updated_at = now();

notify pgrst, 'reload schema';

commit;
