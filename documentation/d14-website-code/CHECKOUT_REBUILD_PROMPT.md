# Implementation Prompt: Sync-first Checkout Fulfillment with Webhook Backstop

## Role

You are a senior engineer implementing a payment-fulfillment refactor in an Angular + Supabase + Stripe project at `/Users/dan/Dev/D14/d14-angular`. Read this entire document before writing any code. Ask clarifying questions only if a step is genuinely ambiguous — otherwise proceed.

## Stack

- Frontend: Angular standalone components, RxJS, ngx-toastr, Tailwind
- Backend: Supabase Edge Functions (Deno)
- Payments: Stripe **embedded** Checkout (`stripe.initEmbeddedCheckout`)
- DB: Supabase Postgres

## Context: read these files first

These contain the existing flow you are refactoring. Read each in full:

- `src/app/features/checkout/checkout.component.ts` — current checkout init and return-URL logic
- `src/app/features/profile/profile.component.ts` lines 840-883 — `addNewFamilyMember()` entry point (the originally-broken flow)
- `src/app/features/membership/membership.component.ts` lines 466-725 — new self-signup entry point
- `supabase/functions/checkout-success/index.ts` — current webhook fulfillment (the primary refactor target)
- `supabase/functions/create-checkout-session/index.ts` — Stripe session creation
- `supabase/functions/createUser/index.ts` — auth user + profile creation; called by fulfillment for family-add and self-signup
- `supabase/functions/_shared/cors.ts` — existing shared module pattern
- `src/app/app.routes.ts` — existing route definitions and guard pattern
- `supabase/manual_migrations/` — migration filename pattern (`YYYY-MM-DD_description.sql`)

## The problem

Today, fulfillment runs **only** via the Stripe webhook → `checkout-success` edge function. Symptoms:

1. **No user-visible confirmation**: after payment, Stripe redirects to `/` (the homepage) — see [checkout.component.ts:52-56](src/app/features/checkout/checkout.component.ts#L52-L56). Users don't know if anything succeeded.
2. **Silent webhook failures**: when the webhook errors mid-flow, the user has paid but nothing happens. Recent confirmed example: adding a family member from the profile page completes payment but the family member never appears.
3. **Hard to debug**: errors only surface in Supabase Edge Function logs, never in the UI.

## Domain model

Read this section before designing or coding. The fulfillment logic must handle every scenario below; the refactor is a no-op for behavior — it only changes *where* and *how* fulfillment runs.

### Member types (`profiles.member_type`)

- `Regular` — individual member.
- `Family` — parent who signs up family members but is not personally an active member. They have a `profiles` row, log in normally, and "own" their children's accounts; they do not have a `memberships` row of their own.
- `Charter` — organizational membership. One virtual `profiles` row represents the org's membership, linked to an `organizations` row.
- `null` — has an account but no membership currently. E.g., a parent who signed up family-only and hasn't activated their own membership yet, or a child whose own membership lapsed.

### Identity rules

- **Family members are linked via `profiles.parent_id`** pointing to the parent's `profiles.id`. A profile is a family member iff `parent_id IS NOT NULL`.
- **Child auth emails are synthesized** by `createUser`: given parent email `local@domain`, child N gets `local+childN@domain`. The function picks the lowest available `N`. Never bypass this — login depends on it.
- **Receipts**: today, receipts for new-signup, parent-upgrade, and renewal are recorded with `profile_id = parent's id`; receipts for post-signup family-add are recorded with `profile_id = the new child's id`. **Preserve this exactly** in the refactor (do not "fix" the inconsistency in this pass).

### Pricing / quantity rules

The `create-checkout-session` function sets Stripe line-item `quantity` based on how many memberships are being created or renewed in this checkout. Preserve this exactly:

| Scenario                                      | Quantity                                            |
| --------------------------------------------- | --------------------------------------------------- |
| New user, individual                          | 1                                                   |
| New user, individual + N family               | 1 + N                                               |
| New user, family-only (parent not a member)   | N (parent excluded)                                 |
| New charter org                               | 1 (single virtual member, charter price ID)         |
| Renewal (self and/or family)                  | count of `renewals` rows for this parent            |
| Add family member to existing membership      | count of temp_membership_form_data rows (parent_id) |
| Existing non-member parent upgrades to Regular| count of temp_membership_form_data rows (user_id)   |

Charter uses `environment.stripePriceIdCharter`; everything else uses `environment.stripePriceIdDefault`.

### Membership lifecycle rules

- New membership: `expiration = date_created + 1 year`.
- Renewal where current expiration is **in the future**: `new_expiration = current_expiration + 1 year` (extend, don't reset).
- Renewal where current expiration is **in the past**: `new_expiration = today + 1 year` (relapsed members start fresh).
- Renewal idempotency check: `last_modified >= session.created` means this renewal was already processed; skip.

### Workflow scenarios that must be supported

Mark each in mental checklist as the implementation is verified. The refactor must not regress any of these.

| #  | Scenario                                                                                              | Entry point                                                       | Checkout metadata        | Fulfillment writes                                                                                                       |
| -- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| 1  | New user, individual Regular signup                                                                   | `/secure/membership` → "Regular" → "myself only"                  | `new_membership`         | Update `profiles`; insert `memberships` (parent); insert `membership_receipts` (parent); delete temp rows.               |
| 2  | New user, Regular signup + N family members                                                           | `/secure/membership` → "Regular" → "myself AND family"            | `new_membership`         | All of #1, **plus** create N child auth users + profiles via `createUser`, insert `memberships` for each child.          |
| 3  | New user, family-only (parent creates child memberships but is not a member themselves)               | `/secure/membership` → "family only" toggle                       | `new_membership`         | Update parent profile (`member_type = 'Family'`, no parent membership); create N child auth users; insert N memberships. |
| 4  | New charter organization signup                                                                       | `/secure/membership` → "Charter" form                             | `new_membership`         | Insert `organizations` row (already done client-side pre-checkout); update virtual profile; insert charter membership.   |
| 5  | Existing member renews themselves                                                                     | Profile → "Renew" with self selected                              | `renewal`                | Extend `memberships.expiration` for self; insert receipt; delete `renewals` rows.                                        |
| 6  | Existing member renews family members (any combination of self + children)                            | Profile → "Renew" with multiple selections                        | `renewal`                | Extend `memberships.expiration` for each selected `renewals.id`; insert one receipt; delete those `renewals` rows.       |
| 7  | Existing member adds a new family member to their existing membership *(originally-broken flow)*      | Profile → "Add Family Member"                                     | `post_signup_membership` | Create child auth user + profile via `createUser`; insert child membership (1-year); insert receipt on child; delete temp rows. |
| 8  | Existing non-member parent (`member_type` was `Family` or null) activates their own Regular membership | Profile → "Activate full membership"                              | `post_signup_membership` | Update parent profile (`member_type = 'Regular'`, `ama_number`, `disciplines`); insert parent membership; insert receipt on parent; delete temp rows. |

If any scenario above turns out not to exist in the current code (e.g., #3 family-only or #4 charter is partially built), document the gap in your PR description rather than silently skipping it — but do not extend scope to *fix* missing flows in this refactor.

### Async-payment caveat (applies to every scenario)

If `session.payment_status !== 'paid'` (ACH, SEPA, some wallets confirm later), fulfillment must return `pending` and write nothing. The webhook backstop will fulfill once the payment confirms. The completion page must show a "still processing" message.

## Target architecture

Two fulfillment paths, both idempotent, both calling the **same** shared logic:

1. **Sync path (NEW, primary)** — After Stripe payment, redirect to a new `/secure/checkout/complete?session_id=...` page. That page calls a new `fulfill-checkout` edge function, which retrieves the session from Stripe, verifies payment, runs fulfillment, and returns the result. The user sees a real success / pending / error screen.

2. **Webhook path (existing, kept as backstop)** — `checkout-success` continues to receive Stripe webhook events. Refactored to call the same shared fulfillment logic. Catches: closed-tab cases, async payment methods (ACH/SEPA confirm minutes-to-hours later), redirect failures, network drops.

Both paths must be idempotent on `stripe_session_id` so whichever runs first wins; the second is a no-op.

---

## Tasks (in order)

### Task 1: Add idempotency constraint

Add a migration at `supabase/manual_migrations/<TODAY>_unique_stripe_transaction_id.sql`:

```sql
-- Ensure no two membership_receipts can share a stripe session id.
-- This is the natural idempotency key for fulfillment.
ALTER TABLE membership_receipts
  ADD CONSTRAINT membership_receipts_stripe_transaction_id_unique
  UNIQUE (stripe_transaction_id);
```

Before applying: run a check for existing duplicate non-NULL `stripe_transaction_id` values. If any exist, **stop and report them to the user** rather than auto-resolving — duplicates indicate prior fulfillment bugs and need human review. NULLs are fine (Postgres allows multiple NULLs in a unique constraint).

### Task 2: Extract the shared fulfillment module

Create `supabase/functions/_shared/fulfillment.ts`. Move the post-line-274 logic from `supabase/functions/checkout-success/index.ts` into a single exported function:

```ts
export type FulfillmentResult =
  | { status: 'fulfilled'; message: string }
  | { status: 'already_fulfilled' }
  | { status: 'pending'; message: string }            // payment_status !== 'paid'
  | { status: 'error'; message: string; retryable: boolean };

export async function fulfillCheckoutSession(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session,
): Promise<FulfillmentResult>;
```

Implementation requirements:

- **Caller is responsible for retrieving the Stripe session.** Don't fetch from Stripe inside this function.
- If `session.payment_status !== 'paid'`, return `{ status: 'pending', ... }` and write nothing. (Handles ACH/SEPA delayed-confirmation case.)
- **Idempotency check is the FIRST mutation, not a read-then-write.** Attempt the receipt insert at the top. On unique-violation (Postgres error code `23505`), short-circuit to `{ status: 'already_fulfilled' }`. Only proceed with the rest of the work if the receipt insert succeeds. This makes the sync/webhook race resolve cleanly without read-write windows.
- Use `session.metadata.checkout_type` as the primary branch selector: `'new_membership' | 'post_signup_membership' | 'renewal'`. Preserve the existing fallback inference (current code under "isRenewalCheckout" detection) only when metadata is missing.
- Preserve all three existing branches: new self-signup, post-signup family member, renewal. Don't redesign them — just relocate them.
- Wrap email sends so an SMTP failure does not fail fulfillment. Log the email error; return `{ status: 'fulfilled' }` anyway.
- Cleanup of `temp_membership_form_data` and `renewals` rows happens at the **end** of a successful path, not interleaved.
- Do **not** delete temp/renewal rows on `pending` or `error` returns — the other path needs them to retry.
- For DB / network errors, return `{ status: 'error', retryable: true }`. For data-shape errors (e.g., missing required temp data, profile not found), return `{ status: 'error', retryable: false }`.

### Task 3: Refactor `checkout-success/index.ts` to use the shared module

Replace the inline fulfillment with a thin webhook adapter:

1. Verify the Stripe webhook signature if `STRIPE_WEBHOOK_SECRET` is configured (check current code; add verification if missing — this is a separate small hardening that's worth doing now).
2. Parse the event. For events of type `checkout.session.completed`, extract the session from `event.data.object`.
3. If the event payload's session is "thin" (only IDs), retrieve the full session from Stripe.
4. Call `fulfillCheckoutSession(supabase, session)`.
5. Map the result to HTTP status:
   - `fulfilled` / `already_fulfilled` / `pending` → 200
   - `error` with `retryable: true` → 500 (Stripe will retry)
   - `error` with `retryable: false` → 200 + log loudly (Stripe retries won't help)

### Task 4: New edge function `fulfill-checkout`

Create `supabase/functions/fulfill-checkout/index.ts`:

- Accept `POST { session_id: string }`.
- Authenticate: require the user's Supabase JWT in the `Authorization` header. Use the same auth pattern as other authed functions in this repo (check `updateUser`, `deleteUser`, etc.).
- Retrieve the session from Stripe: `GET https://api.stripe.com/v1/checkout/sessions/{session_id}` with `Authorization: Bearer ${STRIPE_SECRET_KEY}`.
- **Authorization check**: verify `session.metadata.user_id === <authenticated user's id>`. Return 403 if not. This prevents one user from triggering fulfillment for another's session.
- Call `fulfillCheckoutSession(supabase, session)`.
- Return the result as JSON with status 200 (the client interprets the `status` field).

### Task 5: New `CheckoutCompleteComponent`

Create `src/app/features/checkout/checkout-complete.component.ts` (+ `.html`, `.css` matching the existing checkout component's structure).

Behavior:

- Inject `ActivatedRoute`, `Router`, `HttpClient`, `AuthService`, `environment`.
- On `ngOnInit`, read `session_id` from query params.
- If missing, navigate to `/secure/profile` immediately.
- Otherwise, POST to `${environment.supabaseUrl}/functions/v1/fulfill-checkout` with `{ session_id }` and the user's JWT in the Authorization header.
- Render one of four states:
  - **loading** (default while the request is in flight): "Finalizing your membership..." with a spinner.
  - **success** (`status: 'fulfilled'` or `'already_fulfilled'`): "Your membership has been updated." Button: "Go to Profile" → `/secure/profile`.
  - **pending** (`status: 'pending'`): "Your payment is still processing. You'll receive a confirmation email when it completes." Button: "Go to Profile."
  - **error** (`status: 'error'` or HTTP failure): show the message and a `mailto:secretary@ama-d14.org` contact link plus a "Go to Profile" button so the user is not stuck.
- Do not auto-redirect on success — show the confirmation, let the user click through. This is the whole point of the refactor.

### Task 6: Add the route

In `src/app/app.routes.ts`, add a route for the new component, mirroring guards / lazy-loading style of the existing `secure/checkout` route:

```ts
{
  path: 'secure/checkout/complete',
  loadComponent: () =>
    import('./features/checkout/checkout-complete.component')
      .then((m) => m.CheckoutCompleteComponent),
  // copy the same canActivate guard the existing /secure/checkout route uses
}
```

### Task 7: Update the Stripe return URL

In [checkout.component.ts:52-56](src/app/features/checkout/checkout.component.ts#L52-L56), replace:

```ts
private getReturnUrl(): string {
  const profileUrl = window.location.href.replace('/secure/checkout', '/');
  return profileUrl;
}
```

with:

```ts
private getReturnUrl(): string {
  return `${window.location.origin}/secure/checkout/complete?session_id={CHECKOUT_SESSION_ID}`;
}
```

`{CHECKOUT_SESSION_ID}` is a literal placeholder string; Stripe substitutes the actual session ID at session-creation time. This is the documented Stripe pattern for embedded checkout return URLs.

### Task 8: Verify three flows end-to-end

For each flow below, confirm:
- The user lands on `/secure/checkout/complete` after payment.
- The completion page shows success within ~3 seconds.
- The expected DB writes happened (use Supabase studio or psql to inspect).
- A page refresh on the completion page does not re-fulfill (idempotency).
- Manually invoking the webhook function for the same `session.id` returns `already_fulfilled`.

Flows:

1. **New self-signup** — brand new user → `/secure/membership` → checkout → completion.
   Expected writes: `profiles` updated, `memberships` row inserted (1 per member), `membership_receipts` row inserted (1, on the parent), `temp_membership_form_data` rows for this user/parent deleted.

2. **Add family member from profile** (the originally-broken flow) — existing member → profile → "Add Family Member" → checkout → completion.
   Expected writes: new auth user created with `+childN@` email, `profiles` row inserted with correct `parent_id`, `memberships` row inserted for the new child, `membership_receipts` row inserted (with the new child's `profile_id`, per current code), temp data deleted.

3. **Renewal** — existing member with pending renewals → checkout → completion.
   Expected writes: `memberships.expiration` extended for each selected `renewals.id`, `membership_receipts` row inserted (on the parent), `renewals` rows deleted.

### Task 9: Smoke-test the webhook backstop

Disable the sync path (e.g., comment out the fulfill call in `CheckoutCompleteComponent` temporarily) and run flow #2 again. Confirm the webhook still successfully fulfills. Re-enable the sync path before considering the task complete.

---

## Idempotency model (single source of truth)

The unique constraint on `membership_receipts.stripe_transaction_id` (Task 1) is the entire idempotency mechanism.

In `fulfillCheckoutSession`:
1. Attempt `INSERT INTO membership_receipts (stripe_transaction_id, ...)` immediately.
2. On unique-violation → `already_fulfilled`, return without further work.
3. On success → proceed with the rest of the fulfillment.

This collapses the race window between sync and webhook paths to a single atomic DB operation.

For renewals where multiple membership rows update inside a single fulfillment, the existing `last_modified >= createdDate` check stays — it's a secondary safety net but no longer load-bearing.

---

## Out of scope (do not change)

- Stripe price IDs / pricing logic.
- The `createUser` edge function — its existing behavior is correct when called from fulfillment.
- Auto-renew / subscription handling (the `recurring` parameter stays as-is).
- The shape of `temp_membership_form_data` rows.
- Charter-member organization creation flow.
- Any frontend other than `checkout.component.ts` (return URL only) and the new completion component.

---

## Acceptance criteria

- [ ] Migration applied; unique constraint on `membership_receipts.stripe_transaction_id` exists.
- [ ] `_shared/fulfillment.ts` exists; `checkout-success` and `fulfill-checkout` both call it; no fulfillment logic is duplicated.
- [ ] After payment for a family-member-add, user lands on a "Membership updated successfully" page within ~3s.
- [ ] After clicking "Go to Profile" from the success page, the new family member appears immediately.
- [ ] Flows 1, 2, 3 all produce the expected DB writes per Task 8.
- [ ] Disabling the webhook entirely and running Flow 2 still works (sync path is sufficient for synchronous payments).
- [ ] Replaying the same Stripe webhook event twice does not double-fulfill (second attempt returns `already_fulfilled`).
- [ ] An ACH / async-confirmation payment (test via Stripe test bank `000123456789` if available) shows the "pending" state on the completion page and is correctly fulfilled later by the webhook.
- [ ] No console errors or unhandled promise rejections in the completion page.
- [ ] All existing automated tests still pass.

---

## Working notes for the implementer

- **Don't try to migrate to a single fulfillment path.** Webhooks remain as backstop — that's the whole design. If you find yourself deleting the webhook function, stop.
- **Don't change `createUser` or `create-checkout-session`** except to add the new metadata if absolutely necessary. The bug being fixed is in fulfillment, not creation.
- **Preserve the three existing fulfillment branches' behavior exactly.** The refactor is a relocation + idempotency tightening, not a redesign of what each branch does.
- **Test in a Supabase branch / local dev**, not production. Stripe test mode keys for the dev environment.
- **Surface migration check failures.** If duplicate `stripe_transaction_id` rows exist in production data, do not auto-delete — report them and let the user decide.
