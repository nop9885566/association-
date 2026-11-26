# Association fee overview

Fee summary and caretaker member-management app built with Next.js App Router and Supabase. Public responses include aggregate counts only; student identifiers, individual payment records, and receipt URLs are not exposed.

The app uses the Supabase `anon` key and does not use Supabase Auth. Caretakers can sign in at `/login` using a 4–6 digit PIN. A database-backed, expiring session is stored in an HTTP-only cookie; individual payment records are only returned for a valid session. The fee summary remains public.

The caretaker dashboard (`/`) shows payment summary cards and student-by-student payment tracking. The member directory is available at `/members`, fee-item management at `/fees`, and guardian/student payment comparison at `/records`.

## Setup

1. Run the SQL migrations in `supabase/migrations` in timestamp order in the Supabase SQL Editor. They create the fee and caretaker schemas if missing, secure direct table access, and grant `anon` access to summary, caretaker login, session, and session-checked record functions. The fee-item migration adds name and contact fields while preserving existing rows. The member-directory migration creates a separate one-row-per-student directory. The ITPC data migration populates it directly from the existing `public.itpc_family_students_rows`, `public.itpc_family_guardians_rows`, and `public.itpc_students_rows` tables. The member/fee-period migration adds classroom, fee type, academic year, and semester fields; existing fee rows keep their period unclassified until edited. The student-promotion migration backfills blank classrooms from `public.itpc_students_rows.grade`. The promotion-preview migration compares active members against `public.student.grade` by student ID, presents room mismatches and skipped records for review, and rejects a confirmation if the source data changed after the preview. The student-directory classroom migration displays `public.student.grade` when the saved classroom is blank. The directory-sort migration orders recognized classes from อ.1 through ป.6, then orders room numbers numerically; unsupported or blank classrooms appear after recognized classes. The directory-filter migration adds server-side filtering by grade level before pagination. The classroom-backfill migration fills only blank member classrooms for unique student ID matches in `public.student`, preserving existing nonblank values. The payment-tracking migration adds a session-checked RPC that aggregates membership and semester fees per active student, falls back to `public.student.grade` for a blank classroom only when the student ID has a unique match, and supports search, grade filters, pagination, and CSV export. The fee-schedule migration stores editable annual rates and optional payment windows for membership and both tuition semesters; it does not create example rates or alter existing fee items. Promotion marks ป.6 inactive as graduated and skips unsupported classroom formats. The caretaker migration expects `public.caretakers` to have `id`, `name`, `pin_hash`, and `is_active` columns if that table already exists.
   The student-filtered payment-record migration adds a session-checked RPC used by the report's per-student review link.
2. Add caretaker records in the Supabase SQL Editor. Store only a bcrypt hash, for example:

   ```sql
   insert into public.caretakers (name, pin_hash)
   values ('ชื่อผู้ดูแล', extensions.crypt('REPLACE_WITH_PIN', extensions.gen_salt('bf', 12)));
   ```

   Replace the example name and PIN before running it. To change a PIN, update `pin_hash` with a newly generated hash; never send a PIN or PIN hash to the browser.
3. After the table-creation migration, import the provided `association_fee_student_items_rows.sql` data file into Supabase. Import the payment submissions rows file only if that table has not already been populated.
4. Copy `.env.example` to `.env.local` and set `SUPABASE_URL` and `SUPABASE_ANON_KEY` from the Supabase project settings. The anon key is intended for public use; never use a service-role key in this app.
5. Install dependencies and start the app:

   ```sh
   npm install
   npm run dev
   ```

`GET /api/fees` returns aggregate counts, active family/student totals, and approved payment totals for membership fees and tuition semesters in academic year 2569. `GET /api/auth/caretakers` returns caretaker IDs and names; `POST /api/auth/login` verifies a PIN without returning its hash and creates a database-backed session. `GET` and `PUT /api/fees/schedule` require that session and read or save annual fee rates and optional payment windows. `GET /api/fees/tracking` requires that session and returns a paginated, searchable report of each active student's membership and semester 1–2 fees, totals, approved payments, and review states; add `export=csv` to download all matching rows. `GET /api/fees/records` requires that session and shows the latest submission's guardian/uploader name alongside `student_id`, joined by `student_item_id`; add `studentId` to inspect one student's submissions. Caretakers can add, edit, and delete member-directory entries through the authenticated member endpoints; each entry stores one child, up to two parent names, a student ID, and classroom. The directory links to fee records by `student_id` and prevents changing or deleting an ID when fee items already use it. Fee items remain managed per cycle and now require a fee type and academic year; tuition items also require semester 1 or 2. Unclassified existing fee items are not counted as paid toward these new period summaries. Bulk promotion first opens a review of the active member directory against `public.student.grade`; a separate acknowledgement is required to apply it, and repeats can be corrected by editing the student's classroom afterward. The private storage bucket is not accessed or made public.
