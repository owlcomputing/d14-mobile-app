// New individual / family membership from the app. Mirrors the website's
// membership form submit (d14-angular membership.component.ts, "Regular"
// path) so the website's create-checkout-session and fulfill-checkout handle
// it unchanged:
//
//   1. Clear anything staged by an earlier, unfinished checkout.
//   2. Create each new family member as a child account (createUser edge
//      function, from = 'membership': no membership yet, checkout pays for it).
//   3. Stage the account holder's form in temp_membership_form_data.
//   4. Stripe checkout: priced per person = child accounts (+1 unless
//      "family only"); fulfillment copies the form onto the profile and
//      creates a membership for everyone.
//
// Charter (club) memberships stay on the website.
import * as Crypto from 'expo-crypto';

import { runHostedCheckout, type CheckoutOutcome } from './checkout';
import { supabase } from './supabase';

/** Same values the website stores in membership_option */
export type MembershipOption = 'self' | 'selfAndFamily' | 'familyOnly';

export type HolderDetails = {
  firstName: string;
  middleInitial: string;
  lastName: string;
  suffix: string;
  /** YYYY-MM-DD */
  birthdate: string;
  cellPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  amaNumber: string;
  disciplines: string[];
  emergencyName: string;
  emergencyPhone: string;
};

export type FamilyMemberInput = {
  firstName: string;
  middleInitial: string;
  lastName: string;
  suffix: string;
  /** YYYY-MM-DD */
  birthdate: string;
  amaNumber: string;
  disciplines: string[];
};

const blank = (s: string) => (s.trim() ? s.trim() : null);

/**
 * Call one of the website's user-management functions (createUser /
 * deleteUser) as the signed-in user. Uses plain fetch with only the headers
 * those functions allow (Content-Type, Authorization), exactly like the
 * website: supabase.functions.invoke() adds x-client-info/apikey headers that
 * their CORS preflight rejects (matters on web; harmless on native).
 */
async function callUserFunction(
  name: 'createUser' | 'deleteUser',
  method: 'POST' | 'DELETE',
  body: unknown,
) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in again.');
  const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/${name}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? `${name} failed (${res.status})`);
  return json;
}

/** Remove an unpaid family member added during an earlier attempt (parent-only, see deleteUser). */
export async function removeFamilyMember(profileId: string) {
  await callUserFunction('deleteUser', 'DELETE', { profile_id: profileId });
}

export async function startNewMembership(
  input: {
    profileId: string;
    email: string;
    option: MembershipOption;
    holder: HolderDetails;
    newFamily: FamilyMemberInput[];
  },
  onStatus: (status: string) => void,
): Promise<CheckoutOutcome> {
  const { profileId, email, option, holder, newFamily } = input;

  // 1. Clear staged data from any earlier, unfinished checkout (website does the same)
  onStatus('Preparing…');
  const clears = await Promise.all([
    supabase.from('temp_membership_form_data').delete().eq('user_id', profileId),
    supabase.from('temp_membership_form_data').delete().eq('parent_id', profileId),
    supabase.from('renewals').delete().or(`id.eq.${profileId},parent_id.eq.${profileId}`),
  ]);
  const clearError = clears.find((r) => r.error)?.error;
  if (clearError) throw new Error(clearError.message);

  // 2. Family members become child accounts now; checkout prices by child count
  if (option !== 'self') {
    for (const [i, kid] of newFamily.entries()) {
      onStatus(`Adding family member ${i + 1} of ${newFamily.length}…`);
      try {
        await callUserFunction('createUser', 'POST', {
          from: 'membership',
          parent_id: profileId,
          // Family members don't sign in themselves; give them a strong random
          // password instead of the website's fixed default.
          password: Crypto.randomUUID(),
          member_type: 'Regular',
          membership_option: option,
          first_name: kid.firstName.trim(),
          middle_initial: blank(kid.middleInitial),
          last_name: kid.lastName.trim(),
          suffix: blank(kid.suffix),
          birthdate: kid.birthdate,
          ama_number: blank(kid.amaNumber),
          disciplines: kid.disciplines,
          // Shared household details come from the account holder
          email,
          address_line1: holder.addressLine1.trim(),
          address_line2: blank(holder.addressLine2),
          city: holder.city.trim(),
          state: holder.state,
          zip: holder.zip.trim(),
          country: holder.country,
          cell_phone: holder.cellPhone.trim(),
          emergency_contact_name: `${holder.firstName.trim()} ${holder.lastName.trim()}`,
          emergency_contact_phone: holder.cellPhone.trim(),
        });
      } catch (err) {
        throw new Error(
          `Could not add ${kid.firstName}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  // 3. Stage the account holder's form for fulfillment
  const { error: stageError } = await supabase.from('temp_membership_form_data').insert({
    user_id: profileId,
    member_type: option === 'familyOnly' ? 'Family' : 'Regular',
    membership_option: option,
    first_name: holder.firstName.trim(),
    middle_initial: blank(holder.middleInitial),
    last_name: holder.lastName.trim(),
    suffix: blank(holder.suffix),
    address_line1: holder.addressLine1.trim(),
    address_line2: blank(holder.addressLine2),
    city: holder.city.trim(),
    state: holder.state,
    zip: holder.zip.trim(),
    country: holder.country,
    email,
    disciplines: holder.disciplines,
    ama_number: blank(holder.amaNumber),
    birthdate: holder.birthdate,
    cell_phone: holder.cellPhone.trim(),
    emergency_contact_name: blank(holder.emergencyName),
    emergency_contact_phone: blank(holder.emergencyPhone),
    date_signed: new Date().toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
  });
  if (stageError) throw new Error(stageError.message);

  // 4. Pay
  onStatus('Opening secure checkout…');
  return runHostedCheckout(
    {
      priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_DEFAULT,
      user_id: profileId,
      familyOnly: option === 'familyOnly',
      customerEmail: email,
    },
    onStatus,
  );
}
