// Managing family members from the app. Mirrors the website's profile page
// (d14-angular profile.component.ts) so the website's edge functions handle
// everything unchanged:
//
//   * Add a family member: stage them in temp_membership_form_data
//     (parent_id = account holder), then a Stripe checkout with
//     postSignupFamilyMember; fulfill-checkout creates the child account and
//     its membership once paid. One family member per checkout, as on the
//     website (fulfillment handles one staged row).
//   * Become a member yourself (family-only account holders): stage the
//     holder's own row (user_id = holder, member_type 'Regular'), same
//     checkout; fulfillment adds the holder's membership.
//   * Give a family member their own login: createUser with existing_member
//     (copies their membership dates and receipts to a new standalone
//     account), then deleteUser removes the old family entry.
import { runHostedCheckout, type CheckoutOutcome } from './checkout';
import { callUserFunction, type FamilyMemberInput } from './new-membership';
import { supabase, type Profile } from './supabase';

const blank = (s: string | null | undefined) => (s?.trim() ? s.trim() : null);
const today = () => new Date().toISOString().slice(0, 10);

/** Clear anything staged by an earlier, unfinished checkout (the website does the same). */
async function clearStaged(holderId: string) {
  const clears = await Promise.all([
    supabase.from('temp_membership_form_data').delete().eq('user_id', holderId),
    supabase.from('temp_membership_form_data').delete().eq('parent_id', holderId),
    supabase.from('renewals').delete().or(`id.eq.${holderId},parent_id.eq.${holderId}`),
  ]);
  const error = clears.find((r) => r.error)?.error;
  if (error) throw new Error(error.message);
}

const fullName = (p: Pick<Profile, 'first_name' | 'last_name'>) =>
  [p.first_name, p.last_name].filter(Boolean).join(' ');

/** Add one family member to an existing account and pay for their membership. */
export async function addFamilyMember(
  holder: Profile,
  member: FamilyMemberInput,
  onStatus: (status: string) => void,
): Promise<CheckoutOutcome> {
  onStatus('Preparing…');
  await clearStaged(holder.id);

  // Household details come from the account holder (as on the website)
  const { error } = await supabase.from('temp_membership_form_data').insert({
    parent_id: holder.id,
    user_id: null,
    member_type: 'Regular',
    first_name: member.firstName.trim(),
    middle_initial: blank(member.middleInitial),
    last_name: member.lastName.trim(),
    suffix: blank(member.suffix),
    birthdate: member.birthdate,
    ama_number: blank(member.amaNumber),
    disciplines: member.disciplines,
    email: holder.email,
    address_line1: holder.address_line1,
    address_line2: holder.address_line2,
    city: holder.city,
    state: holder.state,
    zip: holder.zip,
    country: holder.country,
    cell_phone: holder.cell_phone,
    home_phone: holder.home_phone,
    emergency_contact_name: fullName(holder) || null,
    emergency_contact_phone: holder.cell_phone,
    date_signed: today(),
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);

  onStatus('Opening secure checkout…');
  return runHostedCheckout(
    {
      priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_DEFAULT,
      user_id: holder.id,
      postSignupFamilyMember: true,
      customerEmail: holder.email ?? undefined,
    },
    onStatus,
  );
}

/** A family-only account holder buys a membership for themselves. */
export async function becomeMemberYourself(
  holder: Profile,
  input: { amaNumber: string; disciplines: string[] },
  onStatus: (status: string) => void,
): Promise<CheckoutOutcome> {
  onStatus('Preparing…');
  await clearStaged(holder.id);

  const { error } = await supabase.from('temp_membership_form_data').insert({
    user_id: holder.id,
    member_type: 'Regular',
    membership_option: holder.membership_option,
    first_name: holder.first_name,
    middle_initial: holder.middle_initial,
    last_name: holder.last_name,
    suffix: holder.suffix,
    birthdate: holder.birthdate,
    ama_number: blank(input.amaNumber),
    disciplines: input.disciplines,
    email: holder.email,
    address_line1: holder.address_line1,
    address_line2: holder.address_line2,
    city: holder.city,
    state: holder.state,
    zip: holder.zip,
    country: holder.country,
    cell_phone: holder.cell_phone,
    home_phone: holder.home_phone,
    emergency_contact_name: holder.emergency_contact_name,
    emergency_contact_phone: holder.emergency_contact_phone,
    date_signed: today(),
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);

  onStatus('Opening secure checkout…');
  return runHostedCheckout(
    {
      priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_DEFAULT,
      user_id: holder.id,
      postSignupFamilyMember: true,
      customerEmail: holder.email ?? undefined,
    },
    onStatus,
  );
}

export class PartialConversionError extends Error {}

/**
 * Give a family member their own login. Their membership (dates and
 * receipts) moves to the new account; the old family entry is removed, so
 * the holder no longer manages them.
 */
export async function convertFamilyMember(
  holder: Profile,
  member: Profile,
  login: { email: string; password: string },
) {
  await callUserFunction('createUser', 'POST', {
    existing_member: member.id,
    email: login.email.trim().toLowerCase(),
    password: login.password,
    first_name: member.first_name,
    last_name: member.last_name,
    member_type: member.member_type,
    membership_option: member.membership_option,
    address_line1: member.address_line1,
    address_line2: member.address_line2,
    city: member.city,
    state: member.state,
    zip: member.zip,
    country: member.country,
    disciplines: member.disciplines,
    ama_number: member.ama_number,
    birthdate: member.birthdate,
    home_phone: member.home_phone,
    cell_phone: member.cell_phone,
    signature: member.signature,
    date_signed: member.date_signed,
    emergency_contact_name: fullName(holder) || member.emergency_contact_name,
    emergency_contact_phone: holder.cell_phone || member.emergency_contact_phone,
  });

  try {
    await callUserFunction('deleteUser', 'DELETE', { profile_id: member.id });
  } catch (err) {
    throw new PartialConversionError(
      `${member.first_name ?? 'Their'} new login was created, but the old family entry couldn't be removed (${
        err instanceof Error ? err.message : String(err)
      }). Please contact the D14 secretary.`,
    );
  }
}
