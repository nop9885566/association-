begin;

create table if not exists public.association_fee_payment_submissions (
  id uuid primary key,
  student_item_id uuid not null,
  submitted_by_firebase_uid text,
  submitted_by_name text,
  submitted_amount numeric(12, 2) not null,
  payment_datetime timestamptz not null,
  slip_bucket text,
  slip_path text,
  slip_file_name text,
  slip_content_type text,
  slip_file_size bigint,
  status text not null,
  review_note text,
  reviewed_by_firebase_uid text,
  reviewed_by_name text,
  reviewed_at timestamptz,
  is_latest boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists association_fee_payment_submissions_student_item_id_idx
  on public.association_fee_payment_submissions (student_item_id);
create index if not exists association_fee_payment_submissions_status_idx
  on public.association_fee_payment_submissions (status);
create index if not exists association_fee_payment_submissions_latest_idx
  on public.association_fee_payment_submissions (student_item_id)
  where is_latest = true;

commit;
