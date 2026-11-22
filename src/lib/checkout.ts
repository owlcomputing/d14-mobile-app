// Stripe hosted checkout shared by renewals and new memberships.
//
// Both use the website's edge functions: create-checkout-session (prices the
// checkout from what's staged in the database: renewals rows, or the new
// member's temp_membership_form_data + family profiles) and fulfill-checkout
// (creates/extends memberships once Stripe says it's paid).
import * as WebBrowser from 'expo-web-browser';

import { supabase } from './supabase';

export const CHECKOUT_RETURN_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/checkout-return?session_id={CHECKOUT_SESSION_ID}`;

export type CheckoutOutcome =
  /** Paid and fulfilled (memberships updated) */
  | 'paid'
  /** Came back from Stripe but the payment is still settling */
  | 'processing'
  /** Browser closed without paying */
  | 'not_completed';

export type CheckoutSessionBody = {
  priceId: string | undefined;
  user_id: string;
  customerEmail?: string;
  /** Renewal of existing memberships (staged in `renewals`) */
  renewal?: boolean;
  /** New signup where only family members (not the account holder) join */
  familyOnly?: boolean;
  /**
   * Existing account adds a family member, or a family-only holder becomes a
   * member (staged in temp_membership_form_data)
   */
  postSignupFamilyMember?: boolean;
};

export async function runHostedCheckout(
  body: CheckoutSessionBody,
  onStatus: (status: string) => void,
): Promise<CheckoutOutcome> {
  if (!body.priceId) throw new Error('Membership price is not configured for this app build.');

  const { data: checkout, error: sessionError } = await supabase.functions.invoke(
    'create-checkout-session',
    {
      body: {
        recurring: false,
        renewal: false,
        postSignupFamilyMember: false,
        familyOnly: false,
        ...body,
        uiMode: 'hosted',
        returnUrl: CHECKOUT_RETURN_URL,
      },
    },
  );
  if (sessionError || !checkout?.url) {
    throw new Error(sessionError?.message ?? 'Could not start checkout');
  }

  // Open Stripe's hosted checkout in a browser. We already know the session
  // id, so we don't depend on the deep-link redirect (Android blocks
  // automatic custom-scheme redirects): when the browser closes, for any
  // reason, we ask fulfill-checkout to verify with Stripe.
  onStatus('Waiting for payment…');
  const result = await WebBrowser.openAuthSessionAsync(checkout.url, 'd14://checkout-complete');
  const deepLinked = result.type === 'success';

  onStatus('Confirming payment…');
  const { data: fulfillment, error: fulfillError } = await supabase.functions.invoke(
    'fulfill-checkout',
    { body: { session_id: checkout.id } },
  );
  if (fulfillError) throw new Error(fulfillError.message);

  if (fulfillment.status === 'fulfilled' || fulfillment.status === 'already_fulfilled') {
    return 'paid';
  }
  if (fulfillment.status === 'pending') {
    // Card payments settle instantly, so "pending" without the post-payment
    // redirect means the browser was closed without paying.
    return deepLinked ? 'processing' : 'not_completed';
  }
  throw new Error(fulfillment.message ?? 'Fulfillment failed');
}
