begin;

create table if not exists public.association_fee_student_items (
  id uuid primary key,
  cycle_id uuid not null,
  student_id text not null,
  amount numeric(12, 2) not null,
  currency_code text not null default 'THB',
  status text not null,
  latest_submission_id uuid,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_firebase_uid text,
  updated_by_firebase_uid text,
  created_by_name text,
  updated_by_name text
);

create index if not exists association_fee_student_items_cycle_id_idx
  on public.association_fee_student_items (cycle_id);
create index if not exists association_fee_student_items_student_id_idx
  on public.association_fee_student_items (student_id);
create index if not exists association_fee_student_items_latest_submission_id_idx
  on public.association_fee_student_items (latest_submission_id);

alter table public.association_fee_student_items enable row level security;
revoke all privileges on table public.association_fee_student_items from anon, authenticated, public;

commit;
