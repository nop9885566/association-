begin;

alter table public.association_fee_payment_submissions enable row level security;
revoke all privileges on table public.association_fee_payment_submissions from anon, authenticated, public;
alter table public.association_fee_student_items enable row level security;
revoke all privileges on table public.association_fee_student_items from anon, authenticated, public;

drop function if exists public.get_association_fee_summary();

create function public.get_association_fee_summary()
returns table (
  fee_total bigint,
  fee_pending bigint,
  fee_submitted bigint,
  submission_total bigint,
  submission_latest bigint,
  submission_waiting bigint,
  submission_approved bigint,
  submission_rejected bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.association_fee_student_items),
    (select count(*) from public.association_fee_student_items where status = 'pending'),
    (select count(*) from public.association_fee_student_items where status = 'submitted'),
    (select count(*) from public.association_fee_payment_submissions),
    (select count(*) from public.association_fee_payment_submissions where is_latest = true),
    (select count(*) from public.association_fee_payment_submissions where is_latest = true and status = 'waiting_for_review'),
    (select count(*) from public.association_fee_payment_submissions where is_latest = true and status = 'approved'),
    (select count(*) from public.association_fee_payment_submissions where is_latest = true and status = 'rejected');
$$;

revoke all privileges on function public.get_association_fee_summary() from public, anon, authenticated;
grant execute on function public.get_association_fee_summary() to anon;

commit;
