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
  - [ ] Prod: needs the `create-checkout-session` `uiMode: 'hosted'` change deployed to prod (see migration checklist), same as renewals.

### Release

- [ ] Ship a new build to the board testers (Adam, James, etc.) for another feedback round, then go live shortly after (~15:09)
- [ ] **Launch on Apple devices (iOS / App Store)**: Android is already deployable; iOS isn't (~14:15). No iOS build has ever been run on EAS.
  - Already done: `ios.bundleIdentifier` is `com.owlcomputing.d14` in [app.json](app.json); `supportsTablet: false`.
  - Apple account setup:
    - Apple Developer Program membership ($99/yr). Decide whose account: OWL Computing's or AMA District 14's (an organization account needs a D-U-N-S number and takes longer to approve).
    - Register the bundle ID and create the app record in App Store Connect.
    - Let EAS generate the distribution certificate, provisioning profile, and **APNs push key** (`eas credentials`). iOS push won't work without the APNs key.
  - Config:
    - Add the App Store Connect app ID / Apple team to `submit.production.ios` in [eas.json](eas.json).
    - Set `ios.config.usesNonExemptEncryption: false` so every upload doesn't stop at the export-compliance question.
    - Check iOS permission prompts: camera (set), calendar (set), microphone (expo-camera default), **Face ID** for app lock (`expo-local-authentication` isn't in `plugins`, so the `NSFaceIDUsageDescription` text may be missing, and that crashes on Face ID devices). Wallet document upload will need photo library text later.
  - Build and test: `eas build -p ios --profile production` → `eas submit -p ios` → TestFlight. Invite the board testers through TestFlight and test on real iPhones: push, Face ID lock, QR scanner, add to calendar, Stripe renewal return (`d14://checkout-complete`), offline cache.
  - App Store review risks to settle before submitting:
    - **Membership payments through Stripe** in [renew.tsx](src/app/renew.tsx): Apple requires in-app purchase for digital content. A D14 membership is a real-world service (racing at events), which should qualify for the exemption, but say so clearly in the review notes.
    - **Account deletion:** Apple requires in-app account deletion for any app that lets users create accounts. Right now the app only signs existing members in, but guest/prospect sign-up will create accounts, so it will need a "Delete my account" option.
    - Sign in with Apple isn't required as long as login stays email/password only (no Google/Facebook login).
    - Demo login for the reviewer, plus review notes explaining the gate-scanner and admin screens.
  - Store listing: App Store screenshots (6.9" iPhone), description (adapt [store-listing.md](documentation/play-store/store-listing.md)), privacy policy URL, App Privacy "nutrition label" answers, age rating, support URL.
- [ ] App store launch (original target: October 2026)

## Performance

- [ ] **Division page content embeds photos as base64.** The website's CMS editor saves images inline in `division_cms_content.content`, so some divisions are huge (staging, 2026-11-12: division 18 = 5.1 MB, 41 = 2.8 MB, 16 = 1.0 MB). Each visit downloads it all, which is slow on mobile data, and it overflowed the app's offline cache on Android ("Row too big to fit into CursorWindow"; division details are no longer cached as a workaround). Fix in d14-angular: upload CMS images to Supabase Storage and store URLs, plus a one-time migration of existing content.

## Security follow-ups (shared database)

Found during the 2026-11-12 security audit. These affect the website too, so coordinate changes with d14-angular.

Fixed 2026-11-12 (staging + prod):
- [x] RLS was off on 9 tables (membership forms, memberships, rules, division media, …), so the public key had full read/write access. See migrations `20261112_rls_*`.
- [x] Every signed-in user could read every profile (addresses, phones, birthdates). Profiles are now limited to self, family and admins; the app's lookup/scanner use the limited `member_directory` view. See `20261112_profiles_privacy.sql`.
- [x] `profiles` insert allowed any ID. Now own ID only.
- [x] Charter (club) signup was broken for non-admins: `organizations` had no insert policy. See `20261112_organizations_insert_policy.sql`.
- [x] `createUser` / `deleteUser` / `updateUser` edge functions had no auth at all: anyone could delete accounts, make themselves admin, or create free memberships. Fixed in d14-angular PR #19 (website sends the user token; functions check it).

Still open:
- [ ] **Child and club accounts are created with the password `password`** (membership form children and admin-created charter accounts, in d14-angular `membership.component.ts` and `organization-management.component.ts`). Child emails are predictable (`parent+child1@…`), so anyone who knows a parent's email can sign in as their child and see the family's profiles. Fix: have `createUser` generate a random password for these accounts. Then decide whether to reset existing ones (find out first whether children ever sign in themselves).
- [x] **`member_directory` was readable by every signed-in user.** Now limited to members, chairmen and admins (`20261112_prospects_and_consents.sql`, staging; prod with the prospect release).
- [ ] **The website's `emails` edge function is an open email relay**: `verify_jwt = false`, no caller check, and it sends to whatever `to` addresses the request gives, from `no-reply@em5910.ama-d14.org`. Anyone can send email that looks like it's from D14 (phishing risk, and it can hurt the domain's sending reputation). Fix in d14-angular: require an admin token when `to` is set (the contact form only needs the default secretary address), and/or add a server-side secret for internal callers like `delete-account`.
- [ ] `renewals` insert policy is `WITH CHECK (true)`; tighten to own/family rows after checking the website renewal flow.
- [ ] Review the other RLS-enabled tables for UPDATE policies with no `USING` clause (same bug fixed in `20261112_rls_remaining_tables.sql`).

## Push notifications

The app needs two kinds of push notifications.

- [ ] **Automatic event notifications** (not built)
  - Send pushes automatically for things on the district calendar (races, events, etc.).
  - Target each one to the event's division, respecting each member's division preferences in [notification-settings.tsx](src/app/notification-settings.tsx).
  - To decide: what triggers a push (new event posted, reminder X days before, day-of, cancellation/change?) and how far ahead.
  - The pg_cron + edge function setup used by [renewal-reminders](supabase/functions/renewal-reminders/index.ts) works as a template. Track which pushes have gone out so nobody gets the same one twice.
  - Note: the notification settings screen already tells users they'll get "event reminders," but nothing sends them yet.

- [ ] **Manual admin notifications with custom content** (partly built)
  - For one-off promotions and targeted announcements.
  - Already works: [send-notification.tsx](src/app/send-notification.tsx) + [send-push](supabase/functions/send-push/index.ts) let an admin send a custom title/body to the entire district or to a single division.
  - Still to do:
    - Choose more than one division at a time (and possibly other audiences later).
    - Attach a link or deep link (an event, division page, renewal screen, or external URL) so tapping the notification opens the right place.
    - Save a history of sent notifications (who sent it, which audience, how many devices received it).
    - Optionally schedule a send for later.

- [ ] **Guest sign-up for notifications ("prospect" users)**. Built on staging 2026-11-12.
  - **How it works:** "Get race reminders" ([signup.tsx](src/app/signup.tsx)): name, email, divisions, separate push / marketing-email opt-ins → 6-digit email code (confirms the email) → real login with `member_type` NULL and no membership (the website's existing "registered, not paid" state; the website sends them to its membership page on login). Consents go to `communication_consents` (append-only, exact wording + source), divisions to `communication_preferences`. Members can also sign in with an emailed code. Profile → Communications toggles; Profile → Delete my account (prospects deleted immediately via `delete-account`; members send a request to the secretary). `member_directory` now members/chairmen/admins only.
  - [ ] Test on device: sign up with a real email (code arrives, profile/consents created), prospect Home/Wallet/Profile, toggles, delete account; member code sign-in.
  - [ ] Prod: run `20261112_prospects_and_consents.sql`, apply [auth email templates](supabase/templates/README.md) + rate limit, deploy `delete-account`.
  - [ ] Admin side: "Prospects only / Members only / Everyone" audience in send screens; prospect list + consent view on the website (see website parity item).
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

- [ ] **Back up every push with an email**
  - When a push goes out (automatic or manual), also email each recipient where we have an email address and they haven't opted out.
  - Reuse the website's SendGrid setup (`emails` edge function in d14-angular, sender `no-reply@em5910.ama-d14.org`) instead of adding a new provider.
  - Use one shared template: push title as the subject, body as the content, plus the same link/deep link as the push.
  - Marketing emails (promotions, prospect outreach) need an unsubscribe link and the district's mailing address (CAN-SPAM). Unsubscribing from email shouldn't turn off push, and vice versa.
  - Handle the "if possible" cases: no email on file, bounced/invalid addresses, unsubscribed users.
  - Record email delivery alongside push in the send history.
  - **Batch the emails** (agreed): when several automatic event pushes go out close together, send each person one combined email (e.g. a digest) instead of one email per push.

- [ ] **Mirror all notification/email admin tools on the D14 website**
  - Everything admins can do in the app for push/email management should also be available in the website's admin area (d14-angular), so admins aren't forced onto their phones.
  - Scope: compose and send manual notifications (custom content, audience: district / divisions / prospects / members), schedule sends, view send history and delivery stats (push + email), manage automatic event notification settings, and view prospects and their consent records.
  - The app and website should call the **same** edge functions (e.g. `send-push`), so audience rules, consent checks, and email backup behave the same no matter where a notification is sent from.
  - Do this in a session that has the d14-angular repo open alongside this one.
