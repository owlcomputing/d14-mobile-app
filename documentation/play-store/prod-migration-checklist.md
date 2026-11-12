# Production Backend Migration Checklist

The mobile app currently targets **D14 Staging**. Before the production build
ships, these changes must be applied to **D14 Prod** (`qxoroicvatularpyltbx`).
All are additive — none affect the live website. Claude can run all of these
on request; items marked 👤 need Dan.

## 1. Database (additive migrations)

- [ ] `supabase/migrations/20260702_push_tokens.sql` — push_tokens table + RLS
- [ ] `supabase/migrations/20260710_event_locations.sql` — events.location_name
      (events.address already exists in prod)

### Security fixes (shared with the website, not app-specific)

- [x] `supabase/migrations/20261112_rls_temp_forms_memberships.sql` — enables
      RLS on `temp_membership_form_data` and `memberships` (both were fully
      readable/writable with the anon key). **Applied to staging and prod
      2026-11-12**, verified with anon REST checks and rolled-back
      parent/child/other-member/admin impersonation tests.
- [ ] `supabase/migrations/20261112_rls_remaining_tables.sql` — enables RLS on
      `division_media`, `rules`, `magazine_issues`, `emails` and the empty
      backup tables; adds missing read/admin/chairman policies and fixes
      UPDATE policies that had no USING clause. **Applied to staging and prod
      2026-11-12.**
- [x] `supabase/migrations/20261112_organizations_insert_policy.sql`: lets
      a signed-in member create their own organization (fixes charter
      signup). **Applied to staging and prod 2026-11-12.**
- [x] `supabase/migrations/20261112_profiles_privacy.sql`: limits profile
      reads to self/family/admins, own-ID inserts, `set_d14_number` as
      SECURITY DEFINER, and the new `member_directory` view used by the
      app's lookup/scanner. **Applied to staging and prod 2026-11-12.** The
      app's lookup/scanner code that uses `member_directory` must ship in the
      next build.
- [x] d14-angular PR #19: `createUser` / `deleteUser` / `updateUser` now
      require the caller's token (website deployed to prod, functions
      deployed to staging and prod 2026-11-12).

### Prospect sign-up (pending)

- [ ] `supabase/migrations/20261112_prospects_and_consents.sql`: consent log,
      preferences, members-only `member_directory`. Applied to staging
      2026-11-12.
- [ ] Auth email templates + email rate limit per
      [supabase/templates/README.md](../../supabase/templates/README.md)
      (Management API). Applied to staging 2026-11-12.

## 2. Edge functions

- [ ] 👤 Commit the `create-checkout-session` change in d14-angular (adds
      `uiMode: 'hosted'` — backward compatible) and deploy to prod
- [ ] Deploy `send-push` (mobile repo) to prod
- [ ] Deploy `delete-account` (mobile repo) to prod (staging deployed 2026-11-12)
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
