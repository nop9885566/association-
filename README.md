# Association fee overview

Read-only fee summary built with Next.js App Router and Supabase. Public responses include aggregate counts only; student identifiers, individual payment records, and receipt URLs are not exposed.

The app uses the Supabase `anon` key and does not use Supabase Auth. Caretakers can sign in at `/login` using a 4–6 digit PIN. A database-backed, expiring session is stored in an HTTP-only cookie; individual payment records are only returned for a valid session. The fee summary remains public.

## Setup

1. Run the SQL migrations in `supabase/migrations` in timestamp order in the Supabase SQL Editor. They create the fee and caretaker schemas if missing, secure direct table access, and grant `anon` access to summary, caretaker login, session, and session-checked record functions. `CREATE TABLE IF NOT EXISTS` preserves existing tables and their data. The caretaker migration expects `public.caretakers` to have `id`, `name`, `pin_hash`, and `is_active` columns if that table already exists.
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

`GET /api/fees` returns aggregate counts. `GET /api/auth/caretakers` returns caretaker IDs and names; `POST /api/auth/login` verifies a PIN without returning its hash and creates a database-backed session. `GET /api/fees/records` requires that session and shows the latest submission's guardian/uploader name alongside `student_id`, joined by `student_item_id`. The `student_id` is an identifier, not a student name. This project has no insert, update, delete, upload, or payment-review endpoints. The private storage bucket is not accessed or made public.
