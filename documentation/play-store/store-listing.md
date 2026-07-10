# Google Play Store Listing — AMA District 14

## App details

- **App name** (30 chars max): `AMA District 14`
- **Package**: `com.owlcomputing.d14`
- **Category**: Sports
- **Free**, no ads, no in-app purchases through Google Play (membership payments
  are for real-world services via Stripe — allowed outside Play Billing)

## Short description (80 chars max)

```
Your D14 membership card, race schedules, and district news — in your pocket.
```

## Full description (4000 chars max)

```
The official app for AMA District 14 members — Michigan's home for motorcycle
Rights, Riding, and Racing.

YOUR MEMBERSHIP CARD, ALWAYS WITH YOU
Pull up your digital D14 membership card anywhere — even with no signal at the
gate. Your card shows your D14 number, membership type, expiration, and a QR
code officials can scan to verify your membership in seconds.

NEVER MISS A RACE
Browse the full district calendar with every division's events. Filter by
discipline, get directions to the track, and add events to your phone's
calendar with one tap.

FOLLOW YOUR DIVISIONS
Motocross, Hare Scrambles, Enduro, Flat Track, Hill Climb, Ice Racing, ATV,
and more — each division has its own page with news, schedules, results,
points standings, and rules.

RENEW IN SECONDS
Renew your membership right in the app with secure Stripe checkout. Renew
early anytime — extra time is always added to your current expiration date.
Get reminders before your membership expires so you're never caught at the
gate with an expired card.

STAY IN THE LOOP
Get push notifications for event reminders, schedule changes, and district
news. Choose exactly which divisions you want to hear from.

THE DIRTBIKE DOWNLOAD
Listen to the official D14 podcast on Spotify or watch on YouTube, right in
the app.

FOR OFFICIALS
Track officials can look up any member by name or D14 number, or scan a
member's QR code for instant verification at the gate.

BUILT FOR MEMBERS
• Works offline — your card and cached schedules are always available
• Face/fingerprint app lock for privacy
• Family memberships supported
• Fast, modern, and built around the D14 brand

An active AMA District 14 account is required to sign in. Not a member yet?
Join at ama-d14.org.
```

## Graphics checklist

- [x] App icon 512×512 — export from `assets/images/icon.png` (already 1024, Play accepts 512; downscale)
- [x] Feature graphic 1024×500 — `documentation/play-store/feature-graphic.png`
- [ ] Phone screenshots (min 2, max 8) — capture on device, suggested set:
  1. Home dashboard (logged in, events + divisions visible)
  2. Membership wallet card with QR
  3. Event calendar with division filter pills
  4. Division page (Motocross — icons + WYSIWYG about)
  5. Event detail with Add to Calendar + Directions
  6. Member lookup with results
  7. Podcast & Media page
  *(Use the test account; avoid real member PII in screenshots)*

## Data safety form answers

| Question | Answer |
|---|---|
| Does your app collect or share user data? | Yes, collects |
| Data encrypted in transit? | Yes (HTTPS everywhere) |
| Can users request data deletion? | Yes — via district contact (list webmaster@ama-d14.org) |
| **Personal info collected** | Name, email, phone, physical address, emergency contact (account data, required, not shared) |
| **Financial info** | Payment handled by Stripe (Stripe collects card data, not the app). Declare "Purchase history" if pressed; card numbers never touch the app |
| **Photos/media** | None collected |
| **Camera** | Used for QR scanning only; images not stored or transmitted |
| **Location** | Not collected (maps open externally) |
| **Device IDs** | Push token (app functionality, not shared beyond Expo push service) |
| Data shared with third parties | Stripe (payments), Expo (push delivery) — both as service providers |

## Prerequisites before submission

1. Google Play Console developer account ($25 one-time) — register as an
   organization (AMA District 14 or Owl Computing) to avoid personal-name listing
2. Privacy policy hosted at a public URL (draft in `privacy-policy.html`;
   suggest https://ama-d14.org/privacy) — REQUIRED by Play
3. Production backend migration completed (see prod migration checklist)
4. Production AAB: `npx eas-cli build -p android --profile production`
5. Content rating questionnaire (expect "Everyone")
6. App access: provide the reviewer a test login (create a prod test account
   with a dummy membership; Play reviewers must be able to sign in)
