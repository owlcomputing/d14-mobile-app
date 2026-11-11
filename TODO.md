# D14 Mobile App — TODO

## From Q3 board meeting (Sept 16, 2026)

Source: [documentation/meetings/q3-board-meeting-feedback.txt](documentation/meetings/q3-board-meeting-feedback.txt)

### Features

- [ ] **Wallet document storage** (board action item, ~5:31–6:34)
  - Let members add their own documents to the wallet: AMA minor release, AMA card, and "anything" else (photo or file).
  - Saved docs must be **available offline** (e.g. at the gate with no signal).
  - No AMA system integration. The board agreed that's not happening; it's just an upload/photo.
  - Board is keeping this as an open action item until the app launches.

- [ ] **Public / guest browsing — no sign-in required** (~7:07–8:00)
  - Anyone can open the app and explore without an account: schedule/calendar, events, divisions, and at least everything that's public on the website today.
  - Sign-in only gates member features (wallet, profile, renewal, notifications settings, admin tools, etc.).
  - Currently the whole app is behind `Stack.Protected guard={!!session}` in [src/app/_layout.tsx](src/app/_layout.tsx).

- [ ] **Capture guest contact info / sign-up prompts** (~8:05–8:32)
  - Get people's info so we can send email reminders about events, etc.
  - Options discussed: a pop-up, and/or calls to action placed throughout the content (e.g. "get email notifications").
  - Goal: don't force membership up front; show value and nudge guests toward buying a membership.

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

- [ ] **Guest sign-up for notifications ("prospect" users)**
  - Guests who aren't members can sign up just to receive notifications. This is also the "sign-up prompt" from the board meeting.
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
