# D14 Mobile App — TODO

## From Q3 board meeting (Sept 16, 2026)

Source: [documentation/meetings/q3-board-meeting-feedback.txt](documentation/meetings/q3-board-meeting-feedback.txt)

### Features

- [ ] **Wallet document storage** (board action item, ~5:31–6:34). Built 2026-11-12; needs on-device testing.
  - "My Documents" on the member wallet: add from Camera, Photos or File (PDF/image), name it (quick picks: AMA Card, AMA Minor Release, Insurance Card, Other), view full screen, rename, share/open, delete.
  - Stored **only on the phone** in the app's private documents folder ([wallet-documents.ts](src/lib/wallet-documents.ts)), per signed-in profile, so it works offline and minors' release forms never leave the device. Not backed up by us; a new phone starts empty. Signing out keeps the files for the next sign-in.
  - No AMA system integration (board agreed it's just an upload/photo).
  - [x] Tested on Android in Expo Go (2026-11-12) after fixing the photo hand-off.
  - [ ] Test on iPhone once the iOS build exists.
  - Later, if wanted: optional cloud backup so documents follow members to a new phone (would need a private Supabase Storage bucket and a privacy policy update).
  - Board is keeping this as an open action item until the app launches.

- [x] **Public / guest browsing — no sign-in required** (~7:07–8:00). Done 2026-11-12.
  - Guests can open home, calendar, events, divisions, rules, contacts and podcast/media. Wallet and Profile tabs show a sign-in / become-a-member prompt ([sign-in-prompt.tsx](src/components/sign-in-prompt.tsx)).
  - Member-only screens (renew, edit profile, lookup, scanner, notification settings, send notification) stay behind `Stack.Protected`; a guest deep link to one lands on the tabs.
  - Login is a dismissible sheet ("Continue browsing as a guest"); signing in closes it and returns to where the user was.
  - Still to check on a real Android/iOS device: login sheet presentation and the sign-out confirm (verified on web only).

- [ ] **Capture guest contact info / sign-up prompts** (~8:05–8:32). Built on staging 2026-11-12 as "Get race reminders" (see Prospects under Push notifications); needs device testing, then prod.
  - Calls to action: Home card for guests, event pages, login screen. Prospects see "Become a D14 member" on Home, Wallet and Profile.

- [ ] **In-app membership signup (individual / family)**. Built 2026-11-12 on staging; needs a real test payment.
  - "Become a Member" ([join.tsx](src/app/join.tsx)) for signed-in non-members: who's joining (just me / me + family / family only) → details → family members → review → Stripe hosted checkout → membership active, Wallet unlocks. Guests create a free account first.
  - Same data as the website's form ([new-membership.ts](src/lib/new-membership.ts)): stages `temp_membership_form_data`, creates family accounts through `createUser` (now with random passwords instead of `password`), and uses the website's `create-checkout-session` / `fulfill-checkout` unchanged. Checkout shared with renewals ([checkout.ts](src/lib/checkout.ts)).
  - Charter (club) memberships stay on the website.
  - Tested on staging up to the Stripe page (test mode, 2 × $15 = $30 for parent + child; staged data matches the website's format), closed unpaid. Not tested: a completed payment. Fulfillment emails "New Membership Signup" to the real secretary@ama-d14.org even from staging, so warn them first.
  - [ ] Test on device: pay with Stripe test card 4242 4242 4242 4242 (any future date / CVC / ZIP), confirm the Wallet card appears.
  - [x] Prod: `create-checkout-session` hosted mode deployed (d14-angular PR #20, 2026-11-13).

### Release

- [ ] Ship a new build to the board testers (Adam, James, etc.) for another feedback round, then go live shortly after (~15:09)
  - Decided 2026-11-13: testers use **production** (real accounts and data). Android testers get an APK install link (EAS `tester` profile in [eas.json](eas.json): production settings, internal distribution); iPhone testers get TestFlight once the Apple account exists.
  - [x] Prod rollout for the tester build (2026-11-13): app migrations, app edge functions, sign-in code emails + rate limit, `create-checkout-session` hosted mode (d14-angular PR #20). See [prod-migration-checklist.md](documentation/play-store/prod-migration-checklist.md).
  - [x] `CRON_SECRET` + daily jobs on prod (2026-11-20, `setup-notification-cron.sh`): renewal reminders + event notifications.
  - [x] Dan smoke-tested the tester APK on prod (EAS build e9708de0, versionCode 2), 2026-11-13.
  - [ ] 👤 Send the install link to the board testers: **versionCode 4** (light mode, wallet crop), EAS build 3735d080.
  - [x] Block `SYSTEM_ALERT_WINDOW` and `DUMP` (added by libraries) in the Android manifest (2026-11-19, `android.blockedPermissions`).
  - Heads-up for testers: Join and Renew on prod are **real charges**.
- [ ] **Launch on Apple devices (iOS / App Store)**: Android is already deployable; iOS isn't (~14:15). No iOS build has ever been run on EAS.
  - Already done: `ios.bundleIdentifier` is `com.owlcomputing.d14` in [app.json](app.json); `supportsTablet: false`.
  - Store accounts (updated 2026-11-20): publish under **OWL Computing Inc.**, the parent company, which already has a D-U-N-S number and existing Apple and Google developer accounts that may have lapsed. Reactivate those rather than create new ones. OWL Computing Development LLC (the new subsidiary) has no D-U-N-S or store accounts, and we're not using it for this. The apps can be transferred to the LLC later if wanted (both stores support app transfers).
    - [ ] 👤 Apple: sign in at developer.apple.com/account as the Account Holder, check membership status, entity name and expiration, and **Renew** ($99/yr) if expired. Note the Team ID.
    - [ ] 👤 Google: sign in at play.google.com/console and check the account is **Organization** type, verified (D-U-N-S), and not closed for inactivity. If it was closed, create a new Organization account under OWL Computing Inc. ($25). Organization accounts skip the 12-tester / 14-day closed-test rule.
    - [ ] 👤 Once approved, create the app record in App Store Connect (name "AMA District 14", bundle ID `com.owlcomputing.d14`, SKU e.g. `d14-mobile`). Note the Apple ID number it shows (the `ascAppId`).
    - [ ] Put `ascAppId` and the Apple team ID in `submit.production.ios` in [eas.json](eas.json).
    - [ ] 👤 First iOS build must be run by Dan in a terminal (Apple sign-in + 2FA): `nvm use && npx eas-cli@latest build -p ios --profile production`. Answer **yes** to letting EAS create the distribution certificate and provisioning profile, and **yes** to setting up push notifications (creates the APNs key; iOS push doesn't work without it).
  - Config:
    - [x] `ios.config.usesNonExemptEncryption: false` so uploads skip the export-compliance question (2026-11-13).
    - [x] Permission prompts: camera, photos, calendar set; **Face ID** text added via the `expo-local-authentication` plugin; microphone removed (iOS text off, Android `RECORD_AUDIO` blocked) since nothing records audio (2026-11-13).
  - iPhone check in **Expo Go** (Dan, 2026-11-13): mostly fine. Two things that Expo Go can't show, to re-test in the real build:
    - **App Lock asked for the device passcode, not Face ID.** Expo Go has no Face ID permission text of ours, so iOS falls back to the passcode. Fixed in config above; confirm Face ID prompts in the TestFlight build.
    - **Push toggle didn't ask for permission.** Expected: push is disabled in Expo Go ([push.ts](src/lib/push.ts)). Confirm the permission prompt in the TestFlight build.
    - [ ] Decide: **Face ID sign-in after signing out.** App Lock only protects a signed-in session; after Sign Out there's nothing to unlock, so you sign in with email again. "Sign in with Face ID" would mean storing the session (or credentials) in the keychain on sign-out instead of clearing it. Dan noticed the gap; decide whether we want it.
  - Build and test: `eas build -p ios --profile production` → `eas submit -p ios --latest` → TestFlight. Board testers aren't App Store Connect users, so add them as **external testers** (public TestFlight link or by email). The first external build goes through Beta App Review (usually about a day) and needs: a feedback email, a short "what to test" note, a demo sign-in for the reviewer, and the privacy policy URL. Test on real iPhones: push permission prompt, Face ID lock, QR scanner, add to calendar, Stripe return (`d14://checkout-complete`), offline cache.
  - App Store review risks to settle before submitting:
    - **Membership payments through Stripe** in [renew.tsx](src/app/renew.tsx): Apple requires in-app purchase for digital content. A D14 membership is a real-world service (racing at events), which should qualify for the exemption, but say so clearly in the review notes.
    - [x] **Account deletion:** Apple requires in-app account deletion for any app that lets users create accounts. Done: Profile → "Delete my account" (prospects deleted right away; members' requests go to the secretary).
    - Sign in with Apple isn't required as long as login stays email/password only (no Google/Facebook login).
    - Demo login for the reviewer, plus review notes explaining the gate-scanner and admin screens.
  - Store listing: App Store screenshots (6.9" iPhone), description (adapt [store-listing.md](documentation/play-store/store-listing.md)), privacy policy URL, App Privacy "nutrition label" answers, age rating, support URL.
- [ ] App store launch (original target: October 2026)

## Performance

- [x] **Division page content embeds photos as base64.** The website's CMS editor saved images inline in `division_cms_content.content` (prod: division 18 = 5.1 MB, 41 = 2.8 MB, 16 = 1.0 MB, 15, 20; 9.75 MB in all). Fix (2026-11-21), d14-angular PR #24: the division and rules editors upload photos to the `Images` bucket (`cms/divisions/<id>`, `cms/rules/<id>`) and store links; base64 pasted as HTML is uploaded on save; photos over 1600 px are scaled down. `scripts/migrate-cms-images.mjs` moved the existing photos: **staging and prod done** (42 photos, 9.75 MB → 28 KB each; PR #24 merged, prod run 2026-11-21, all 42 links load). Division 20's Flat Track schedule image points at a dead old-site URL (the app hides it): ask the chair to re-upload. The app saves division pages for offline use again (pages under 200K characters).
- [ ] **Division image sizes (2026-11-21), d14-angular PR #26 + [20261121_division_image_size.sql](supabase/migrations/20261121_division_image_size.sql).** Chairmen set the main image size (% of page width, `divisions.main_img_width`); the division and rules editors can resize and align photos (saved as inline `width: N%`). App: the division header shows the logo and the main image at that size (was a dimmed background), and page photos follow the editor's size and alignment ([html-content.tsx](src/components/html-content.tsx)). Also fixed: `divisions.logo` / `main_img` still linked to the old website (returns a web page), so every app division banner was blank; the migration points them at the current uploads and the editor now saves them. **Migration applied on staging and prod (2026-11-21; all 12 prod logo/main image links load). Remaining: merge PR #26; app changes need a new build (after versionCode 4).**
  - [x] App: division photos show at their own size (or width attribute), scaled down to fit, centered when the paragraph is, like the website. Small logos were stretched to full width before. Broken images are hidden (division 20 links an old-site image that now returns a web page; the division chair should re-upload it).

## Security follow-ups (shared database)

Found during the 2026-11-12 security audit. These affect the website too, so coordinate changes with d14-angular.

Fixed 2026-11-12 (staging + prod):
- [x] RLS was off on 9 tables (membership forms, memberships, rules, division media, …), so the public key had full read/write access. See migrations `20261112_rls_*`.
- [x] Every signed-in user could read every profile (addresses, phones, birthdates). Profiles are now limited to self, family and admins; the app's lookup/scanner use the limited `member_directory` view. See `20261112_profiles_privacy.sql`.
- [x] `profiles` insert allowed any ID. Now own ID only.
- [x] Charter (club) signup was broken for non-admins: `organizations` had no insert policy. See `20261112_organizations_insert_policy.sql`.
- [x] `createUser` / `deleteUser` / `updateUser` edge functions had no auth at all: anyone could delete accounts, make themselves admin, or create free memberships. Fixed in d14-angular PR #19 (website sends the user token; functions check it).

Still open:
- [x] **Accounts created with known passwords** (`password` for family members and charter accounts, `TemporaryPassword123` for admin-added members). Fixed in d14-angular PR #21: `createUser` now always sets a random password, except when a parent converts their own child into a standalone login. Live on prod 2026-11-20 (functions deployed, website merged, `main` merged into `staging`).
  - Same PR fixes a #19 regression: fulfillment's server-to-server `createUser` call (adding a family member after signup) was rejected. No prod checkouts hit it.
- [ ] **Later (Dan, 2026-11-20: hold for now): reset existing accounts still on default passwords.** Prod samples from 2026-11-19: ~40% of 1,534 family accounts (~600) still on `password`, 1 of 107 charter accounts, and ~5.5% of other members (~550) on `TemporaryPassword123`. None of the sampled accounts was ever signed into after creation, so they can be switched to random passwords without locking anyone out (they'd use "Forgot password"). Do it in batches, because each hash check is slow.
- [x] **`member_directory` was readable by every signed-in user.** Now limited to members, chairmen and admins (`20261112_prospects_and_consents.sql`, staging; prod with the prospect release).
- [x] **The website's `emails` edge function was an open email relay.** Fixed in d14-angular PR #21: only signed-in admins and our own functions (service-role key) choose recipients and HTML. Everyone else can only send an escaped contact-form message to the secretary (Reply-To = submitter, no CC copy). Live on prod 2026-11-20; smoke-tested (a relay attempt gets 400, `createUser` with no sign-in gets 401).
  - Also fixed on prod: the live contact form was sending messages to the **submitter** instead of the secretary, and the app's member "Delete my account" request was failing.
  - Note: the website's GitHub deploy does **not** deploy Supabase functions. Deploy them by hand (`supabase functions deploy <name> --project-ref …`) **before** merging website changes that depend on them.
- [x] **2026-11-21 audit, [20261121_security_fixes.sql](supabase/migrations/20261121_security_fixes.sql): applied on staging and prod (2026-11-21) and verified on both (rolled-back tests as signed-out, member, parent, chairman, admin and service role; all 26 checks pass).** Found with the same policies on prod:
  - `events` had an `ALL … USING (true)` policy: **anyone, even signed out, could edit or delete events.** Now everyone reads; admins and the division's chairman write (the website calendar editor lets chairmen manage their own division's events).
  - **Any signed-in user (including race-reminder sign-ups) could make themselves admin** by updating their own `profiles.role`, or set `parent_id` to join another family and read its profiles. A trigger now lets only admins and server code change `role`, `parent_id`, `d14_number` and `organization_id`.
  - Every signed-in user could read all ~11,000 `memberships`. Now admins, the member and their family (gate lookups use `member_directory`).
  - `renewals` (was `WITH CHECK (true)`): only for yourself or your family, and `parent_id` must be you or the member's real parent.
  - Storage: any signed-in user could upload, overwrite or delete any file in `Images` / `media`. Now only admins and chairmen.
  - [x] UPDATE policies with no `USING`: none left in `public` (checked 2026-11-21).
- [ ] **`supabase/functions/.env.staging` was committed to d14-angular in 2024** (staging service-role key and database URL; a Stripe test key; the old SendGrid key `J46s…`). d14-angular PR #25 stops tracking it, but it's still in git history (private repo, 8 collaborators). Dan: reset the staging database password, roll the staging service-role key, delete the old SendGrid key.

## Tester feedback (2026-11-20)

- [x] **Light mode**: Profile › Appearance: Dark / Light / Match phone (default since 2026-11-21), applies instantly ([theme.tsx](src/lib/theme.tsx), `useColors` / `makeStyles`; `D14Colors` is gone). Membership card and division banner stay dark in both modes. Dark mode pixel-identical to before on web.
  - [ ] Check on a device (next build): Match phone (`userInterfaceStyle` is now `automatic`, native setting), alerts/pickers/keyboard follow the choice, status bar, lock screen, scanner, wallet documents.
- [x] **Crop wallet photos**: camera, library and image files open [Crop Photo](src/app/document/crop.tsx) (drag corners/box, Rotate, Reset) before Add Document. expo-image-manipulator (new native module: needs the next build; also in Expo Go).
  - [ ] Check on a device: a real camera photo isn't sideways (Android EXIF), dragging feels right.

## Push notifications

Built 2026-11-20, tested on staging, **live on prod 2026-11-20** with email in test mode (see "Rollout" below).

- [x] **Automatic event notifications.** [event-notifications](supabase/functions/event-notifications/index.ts) runs daily at 14:00 UTC (9 AM Michigan in winter) via pg_cron. Rules (Dan, 2026-11-20):
  - **Reminder 3 days before** each event (window of 1–3 days, so events added late or a missed run still get one): "Coming up Saturday: …", opens the event.
  - **New events: one daily roundup per device** ("12 new events: Enduro (5), Motocross (7)"), so loading a season's schedule doesn't send a push per event. Events close enough for a reminder get the reminder instead.
  - Only to people following the event's division; events with no division go to everyone. Sent items are tracked in `event_notification_log`, so nothing goes out twice; the first run only records the existing calendar.
  - Not chosen for now: day-before reminder, date/location change alerts.
- [x] **Manual admin notifications** ([send-notification.tsx](src/app/send-notification.tsx), [send-push](supabase/functions/send-push/index.ts)): audience **Everyone / Members / Prospects**, any number of divisions (none = district-wide), optional link (event, division page, renewal screen, or https URL) that opens when the notification is tapped, an "Also send as email" switch, **Send Test to Me**, and a **Sent Notifications** history screen ([notification-history.tsx](src/app/notification-history.tsx), `notification_sends` table: who, audience, push + email counts, problems).
  - Member = the household has a current membership; prospect = everyone else (app sign-ups, registered-but-unpaid, expired members).
  - `send-push` still accepts the old app's `{title, body, division}`, so the current tester APK keeps working.
  - [ ] Later: schedule a send for later.
- [x] **Email copy of every push** (built; **off on prod until Dan reviews a test email**, see Rollout)
  - Who (Dan, 2026-11-20): **members unless they opted out; prospects only if they opted in.** Account holders only (family members share the holder's inbox). Divisions: their saved choice; members who never chose are matched on the disciplines from their membership form.
  - Manual sends: one email per send (push title = subject). Daily event job: **one combined email per person per day** (reminders + new events).
  - SendGrid direct from the edge function (same sender as the website, `no-reply@em5910.ama-d14.org`, Reply-To secretary). Each recipient gets their own **one-click unsubscribe** link ([email-unsubscribe](supabase/functions/email-unsubscribe/index.ts), signed). The email link goes to a confirm page on the website (`/unsubscribe`, d14-angular `email-unsubscribe-page` branch) whose button POSTs to the function; opening the link alone changes nothing, so mail scanners can't unsubscribe people. Supabase serves function GET responses as text/plain, so the function can't host that page; GET on the function redirects to it plus the `List-Unsubscribe` headers. Footer has the mailing address (Dan chose the membership administrator's: 13785 Spring Creek Rd SW, Fife Lake, MI 49633; `D14_MAILING_ADDRESS` secret overrides it).
  - Unsubscribing = an `email_marketing` off row in `communication_consents`, same as the app switch (now "Email news & event reminders"; shows ON for member households that never chose). Push is unaffected.
  - Safety switch `NOTIFY_EMAIL_MODE`: `off` (default), `allowlist` (only `NOTIFY_EMAIL_ALLOWLIST` addresses: staging uses this, since its database is a copy of real members), `live`.
  - Volume on prod: a district-wide members email ≈ 3,300 people.
  - [ ] Later: handle SendGrid bounces/spam reports (event webhook → mark the address).
- [x] 👤 **SendGrid keys were revoked on staging AND prod** (SendGrid 401 "authorization grant is invalid, expired, or revoked"; prod found 2026-11-20 by Dan's Send Test to Me). Everything that sends through `SENDGRID_API_KEY` is failing on prod: the website's `emails` function (contact form, admin emails) and the app's notification emails. **Prod fixed 2026-11-20** (Dan set a new key). [ ] Staging still has the old key `J46sz2eIQs-NY_XkTZihvQ` (the one committed to git); set a separate staging key if staging email is needed. [ ] Delete old keys `J46sz2eIQs-NY_XkTZihvQ` and `ZWMHLUALRIqMk6UTjXndww` from SendGrid if still listed. Also check Supabase Auth → SMTP on both projects in case it uses a SendGrid key (sign-in codes, password resets).
  - Likely cause: SendGrid keys were committed to d14-angular in 2024 (`supabase/functions/.env.staging`, still on main and staging; earlier in `emails/index.ts`). [x] Removed from tracking in d14-angular PR #25 (`.gitignore` already covered it); see the security section for key rotation.
- **Rollout to prod** (Dan OK'd 2026-11-20):
  1. [x] Applied [20261120_notifications.sql](supabase/migrations/20261120_notifications.sql) (additive: two tables, two service-role-only functions).
  2. [x] Deployed `send-push`, `event-notifications`, `email-unsubscribe` (smoke-tested: no-auth/no-secret 401, bad unsubscribe link 400).
  3. [x] Email in test mode: `NOTIFY_EMAIL_MODE=allowlist`, `NOTIFY_EMAIL_ALLOWLIST=webmaster@ama-d14.org`.
  4. [x] Ran `supabase/scripts/setup-notification-cron.sh qxoroicvatularpyltbx`: `CRON_SECRET` set; `event-notifications-daily` (14:00 UTC) and `renewal-reminders-daily` (15:00 UTC) scheduled; dry run OK (first run records the calendar baseline).
  5. [x] d14-angular PR #22 merged (website `/unsubscribe`, also merged into staging); redeployed `send-push`, `event-notifications`, `email-unsubscribe` to prod (footer link → website page, GET redirect). Staging has this already (`SITE_URL=https://ama-d14-stg.web.app`).
  6. [x] Dan's Send Test to Me from APK versionCode 3 (2026-11-20): push arrived (FCM works on prod), link, email and unsubscribe page all good.
  7. [ ] **Hold `NOTIFY_EMAIL_MODE=live` until tester feedback** (Dan, 2026-11-20). Then switch it.
- [x] **Website admin: push + newsletter opt-outs** (Dan, 2026-11-20: many admins use the website). d14-angular **PR #23**: Admin › Emails → **Admin › Notifications** with tabs **Email newsletter** / **Push notification** (push tab = the app's sender via `send-push`, incl. test + history).
  - Newsletters now go through [send-newsletter](supabase/functions/send-newsletter/index.ts) + [newsletter_recipients](supabase/migrations/20261121_newsletter_recipients.sql): division members who unsubscribed are skipped, the rest get an unsubscribe link + mailing address; members picked by name and charter clubs always get it. Same division selection as before (any profile with the discipline). Only `+childN` tags are stripped (the old code mangled 2 real `+` addresses). `NEWSLETTER_EMAIL_MODE` (default live; staging = allowlist).
  - Staging: migration applied, functions deployed, tested (see PR).
  - [x] Prod 2026-11-20: PR #23 merged (also into staging); migration applied; `send-newsletter`, `send-push`, `event-notifications` deployed and smoke-tested.
  - [x] Dan tested Send Test to Me from the website (2026-11-20).

- [ ] **Guest sign-up for notifications ("prospect" users)**. Built on staging 2026-11-12.
  - **How it works:** "Get race reminders" ([signup.tsx](src/app/signup.tsx)): name, email, divisions, separate push / marketing-email opt-ins → 6-digit email code (confirms the email) → real login with `member_type` NULL and no membership (the website's existing "registered, not paid" state; the website sends them to its membership page on login). Consents go to `communication_consents` (append-only, exact wording + source), divisions to `communication_preferences`. Members can also sign in with an emailed code. Profile → Communications toggles; Profile → Delete my account (prospects deleted immediately via `delete-account`; members send a request to the secretary). `member_directory` now members/chairmen/admins only.
  - [ ] Test on device: sign up with a real email (code arrives, profile/consents created), prospect Home/Wallet/Profile, toggles, delete account; member code sign-in.
  - [x] Prod: migration, [auth email templates](supabase/templates/README.md) + rate limit, `delete-account` (2026-11-13).
  - [x] Admin side (app): Everyone / Members / Prospects audience in the send screen (2026-11-20). Prospect list + consent view on the website: see website parity item.
  - Original notes:
  - Collect name and email (phone optional?) and save them in the database as a **prospect** user type, so we can:
    - send them push notifications and emails like any other audience, and
    - market memberships to them later. Track prospect → member conversions.
  - **Record consent explicitly:** separate opt-ins for push and for marketing email, with the timestamp, where they signed up (app, which screen), and the exact consent wording shown.
  - Let prospects pick divisions they're interested in, same as members.
  - When a prospect later buys a membership, convert the same record so their history and preferences carry over (match on email).
  - Prospects should be a targetable audience in the admin send screen (e.g. "Prospects only", "Members only", "Everyone").
  - Current blocker: `push_tokens.profile_id` is required and RLS assumes a signed-in user, so guest devices can't register today.
  - To decide: is a prospect a real auth account (e.g. passwordless email link) with a `profiles` row, or a lighter contact record in its own table? `profiles` is shared with the website, so coordinate any schema change there.

- [x] **Back up every push with an email** (done 2026-11-20; see Push notifications above. Bounce handling is still open there.)
  - When a push goes out (automatic or manual), also email each recipient where we have an email address and they haven't opted out.
  - Reuse the website's SendGrid setup (`emails` edge function in d14-angular, sender `no-reply@em5910.ama-d14.org`) instead of adding a new provider.
  - Use one shared template: push title as the subject, body as the content, plus the same link/deep link as the push.
  - Marketing emails (promotions, prospect outreach) need an unsubscribe link and the district's mailing address (CAN-SPAM). Unsubscribing from email shouldn't turn off push, and vice versa.
  - Handle the "if possible" cases: no email on file, bounced/invalid addresses, unsubscribed users.
  - Record email delivery alongside push in the send history.
  - **Batch the emails** (agreed): when several automatic event pushes go out close together, send each person one combined email (e.g. a digest) instead of one email per push.

- [ ] **Mirror all notification/email admin tools on the D14 website**
  - Done 2026-11-20 (PR #23): compose/send with audience + divisions + link + email copy, Send Test, send history. Still open: scheduled sends (not built in the app either), automatic event notification settings, prospect list + consent records.
  - Everything admins can do in the app for push/email management should also be available in the website's admin area (d14-angular), so admins aren't forced onto their phones.
  - Scope: compose and send manual notifications (custom content, audience: district / divisions / prospects / members), schedule sends, view send history and delivery stats (push + email), manage automatic event notification settings, and view prospects and their consent records.
  - The app and website should call the **same** edge functions (e.g. `send-push`), so audience rules, consent checks, and email backup behave the same no matter where a notification is sent from.
  - Do this in a session that has the d14-angular repo open alongside this one.
