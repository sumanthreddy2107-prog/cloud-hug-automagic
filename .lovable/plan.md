
# Security migration plan

Replace the custom OTP/localStorage auth with Supabase Auth (phone OTP), introduce a `user_roles` table for the owner, and rewrite RLS on every table so the anon key can no longer read or modify sensitive data.

## Why this is breaking

Today every table has `USING (true)` policies because there are no real Supabase users — login is custom code that stores OTPs in plaintext and a flag in `localStorage`. To get real RLS we have to give every signed-in user a real `auth.users` row.

## Heads-up about SMS

Supabase phone OTP needs an SMS provider (Twilio/MessageBird/etc.) configured in Auth settings to send real codes. Until you wire one up, you can:
- Enable **Test OTP** in Supabase Auth settings (you'll add a fixed phone → OTP pair we'll test with), OR
- Sign in with Supabase's whitelisted dev phone numbers.

I'll keep the existing "show dev OTP on screen" behavior off — Supabase Auth will handle delivery.

## Database changes (one migration)

1. Add `user_id uuid` column to `public.students` (nullable, unique, FK to `auth.users`). Backfill: leave existing rows null — they'll be re-linked on next login by phone match.
2. Create `app_role` enum (`owner`, `student`) and `public.user_roles` table with `has_role(_user_id uuid, _role app_role)` security-definer function.
3. Owner role: seeded automatically the first time the owner phone (`settings.owner_phone`) signs in via a `handle_new_user()` trigger on `auth.users`. The trigger:
   - Reads `settings.owner_phone`; if `new.phone` matches → insert `(new.id, 'owner')` into `user_roles`.
   - Otherwise → insert `(new.id, 'student')` and link/create the matching `students` row by phone.
4. Drop `otp_requests` table entirely (Supabase Auth manages OTPs server-side).
5. Enable RLS + replace every `*_all_access` policy:

   | Table | SELECT | INSERT/UPDATE/DELETE |
   |---|---|---|
   | `students` | own row (`user_id = auth.uid()`) OR owner | own row OR owner |
   | `seats` | any authenticated user | owner only |
   | `bookings` | own (`student_id` joined via `students.user_id`) OR owner | owner only (booking creation moves to a server fn) |
   | `notifications` | recipient (`recipient_phone = auth.jwt()->>'phone'`) OR owner | owner only |
   | `settings` | any authenticated user (read) | owner only |

6. Storage `settings` bucket: replace public INSERT/UPDATE/DELETE policies with owner-only policies; keep public SELECT (the QR is shown to students at checkout).
7. Add explicit `GRANT`s to `authenticated`/`service_role` for every table.

## Server functions (new)

- `src/lib/booking.functions.ts` (`createServerFn` + `requireSupabaseAuth`):
  - `createBooking` — student creates their own booking; service role checks seat availability atomically and inserts.
  - `cancelBooking`, `confirmCounterPayment`, `extendGrace`, `releaseSeat`, `blockSeat`, `unblockSeat`, `markPaid` — owner-only (uses `has_role` check inside handler) and updates both `bookings` and `seats`.
- `src/lib/settings.functions.ts` — `saveSettings`, `uploadQr` (owner-only).
- `src/start.ts` — append `attachSupabaseAuth` to `functionMiddleware` so the bearer is forwarded.

## Frontend changes

- `AuthContext` rewrites to wrap `supabase.auth`:
  - `signInWithOtp({ phone })`, `verifyOtp({ phone, token, type: 'sms' })`.
  - Tracks role via a `user_roles` lookup on session change.
  - Drop the `STORAGE_KEY` localStorage code.
- `src/lib/otp.ts` — delete; replaced by `supabase.auth.signInWithOtp/verifyOtp` calls.
- `src/components/ProtectedRoute.tsx` — keep, but use `useAuth().role` derived from server.
- Login pages (`login.student.tsx`, `login.owner.tsx`, `otp.tsx`):
  - Phone field → call `supabase.auth.signInWithOtp` (and reject if owner role mismatches).
  - OTP page → call `supabase.auth.verifyOtp`; on success, redirect to `/student/home` or `/owner/dashboard` based on `user_roles`.
- Owner-only mutation call sites (`owner.seats.tsx`, `owner.bookings.tsx`, `owner.alerts.tsx`, `owner.settings.tsx`) — replace direct `supabase.from(...).update/insert/delete` with the new server functions.
- Student booking flow (`student.book.tsx`, `student.confirm.tsx`, `student.payment.tsx`) — replace direct inserts with `createBooking` server fn.
- Reads stay on the browser client; RLS handles row filtering.

## Cleanup

- Delete `src/routes/owner.tsx` localStorage logout side effects that touch `STORAGE_KEY`.
- Delete `otp_requests` references in code.
- Update `src/integrations/supabase/types.ts` regenerates automatically after migration.

## Order of execution

1. Run migration (schema + RLS + drop `otp_requests` + storage policies + trigger).
2. Add server functions and wire `attachSupabaseAuth` in `start.ts`.
3. Rewrite `AuthContext`, login pages, OTP page.
4. Update owner pages + student booking flow to use server functions.
5. Verify build, manually walk through student login → booking and owner login → seat block.

## Risk

- Any signed-out visitor will lose all access (intended).
- Existing `students`/`bookings` rows are kept; the first login by an existing phone re-links via the trigger.
- If no SMS provider is configured, sign-in fails until you set one up or whitelist a test phone in Supabase Auth.

Approve and I'll execute step by step.
