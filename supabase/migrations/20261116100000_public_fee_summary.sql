begin;

alter table public.association_fee_payment_submissions enable row level security;
revoke all privileges on table public.association_fee_payment_submissions from anon, authenticated, public;

commit;
