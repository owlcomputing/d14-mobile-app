# Production Backend Migration Checklist

The mobile app currently targets **D14 Staging**. Before the production build
ships, these changes must be applied to **D14 Prod** (`qxoroicvatularpyltbx`).
All are additive — none affect the live website. Claude can run all of these
on request; items marked 👤 need Dan.

## 1. Database (additive migrations)

- [ ] `supabase/migrations/20260702_push_tokens.sql` — push_tokens table + RLS
- [ ] `supabase/migrations/20260710_event_locations.sql` — events.location_name
      (events.address already exists in prod)

## 2. Edge functions

- [ ] 👤 Commit the `create-checkout-session` change in d14-angular (adds
      `uiMode: 'hosted'` — backward compatible) and deploy to prod
- [ ] Deploy `send-push` (mobile repo) to prod
- [ ] Deploy `checkout-return` (mobile repo, `--no-verify-jwt`) to prod
- [ ] Deploy `renewal-reminders` (mobile repo, `--no-verify-jwt`) to prod
- [ ] Set prod `CRON_SECRET` function secret (generate a fresh one — do not
      reuse staging's)
- [ ] Schedule the daily pg_cron job on prod (15:00 UTC) pointing at prod's
      renewal-reminders URL with the prod secret
      - ⚠️ Verify pg_cron + pg_net are enabled on prod first (both were in the
        prod schema dump, so they should be)

## 3. Push notifications

- [ ] 👤 Decide: reuse the `ama-d14-stg` Firebase project for prod push, or
      register the Android app in the `ama-d14` Firebase project (cleaner).
      If ama-d14: create Android app (com.owlcomputing.d14), upload that
      project's service-account key to EAS, and rebuild.
      Note: one EAS project can only hold ONE FCM key — whichever Firebase
      project's google-services.json ships in the production build must match
      the uploaded key.

## 4. App configuration (already done)

- [x] `eas.json` production profile pins prod Supabase URL/anon key, live
      Stripe price IDs, and https://ama-d14.org

## 5. Verification before submission

- [ ] Production build installed on a device: login with a real prod account
- [ ] Wallet card renders with prod data
- [ ] Renewal end-to-end with a REAL card (live mode!) — consider a $1 test
      price or refund the transaction afterward
- [ ] Push: send a targeted test notification from an admin account
- [ ] 👤 Create a Play-reviewer test account in prod (dummy member, active
      membership) and put its credentials in the Play Console "App access" form
