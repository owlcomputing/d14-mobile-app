// Shared checkout fulfillment logic, invoked by:
//   - the Stripe webhook (`checkout-success`) — backstop path
//   - the sync `fulfill-checkout` function called from the completion page
//
// Both paths converge here, and idempotency is enforced by a unique constraint
// on membership_receipts.stripe_transaction_id: the first writer wins, the
// second gets a 23505 unique-violation and short-circuits to `already_fulfilled`.

// deno-lint-ignore-file no-explicit-any
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type FulfillmentResult =
  | { status: 'fulfilled'; message: string }
  | { status: 'already_fulfilled' }
  | { status: 'pending'; message: string }
  | { status: 'error'; message: string; retryable: boolean };

interface StripeCheckoutSession {
  id: string;
  created: number;
  amount_total: number;
  payment_status: string;
  receipt_url?: string;
  metadata?: Record<string, string> | null;
}

const PG_UNIQUE_VIOLATION = '23505';

export async function fulfillCheckoutSession(
  supabase: SupabaseClient,
  session: StripeCheckoutSession,
  options: {
    supabaseUrl: string;
    serviceRoleKey: string;
  },
): Promise<FulfillmentResult> {
  try {
    if (session.payment_status !== 'paid') {
      return {
        status: 'pending',
        message:
          'Payment is still processing. Your membership will be updated once it confirms.',
      };
    }

    const userId =
      typeof session.metadata?.user_id === 'string'
        ? session.metadata.user_id
        : undefined;

    if (!userId) {
      return {
        status: 'error',
        message: 'Stripe session is missing user_id metadata.',
        retryable: false,
      };
    }

    // Sequential short-circuit: if a receipt already exists for this session,
    // the other path (sync/webhook) already finished. Return without re-running
    // any branch — the per-branch INSERT remains the source of truth for the
    // CONCURRENT race (it'll catch a duplicate via 23505), but this read avoids
    // erroring out on follow-up calls where temp/renewal rows have been cleaned
    // up by the path that ran first.
    const { data: existingReceipt, error: existingReceiptError } = await supabase
      .from('membership_receipts')
      .select('id')
      .eq('stripe_transaction_id', session.id)
      .limit(1);

    if (existingReceiptError) {
      return retryable(
        `Error checking existing receipt: ${existingReceiptError.message}`,
      );
    }
    if (existingReceipt && existingReceipt.length > 0) {
      return { status: 'already_fulfilled' };
    }

    const createdDate = new Date(session.created * 1000);
    const sessionCreatedIso = createdDate.toISOString();
    const amountPaid = session.amount_total / 100;
    const checkoutType =
      typeof session.metadata?.checkout_type === 'string'
        ? session.metadata.checkout_type
        : undefined;
    const renewalIdsFromMetadata =
      typeof session.metadata?.renewal_profile_ids === 'string'
        ? session.metadata.renewal_profile_ids
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
        : [];

    // Load the data needed to (a) decide which branch to run and (b) figure out
    // whose profile_id the receipt should be attributed to. We don't insert the
    // receipt until we know which profile_id to use — but we never wait long
    // between this read and the insert, so the unique constraint remains the
    // single source of idempotency truth.
    const [
      renewalQuery,
      memberQuery,
      tempChildQuery,
      tempParentQuery,
      profileQuery,
    ] = await Promise.all([
      supabase
        .from('renewals')
        .select('*')
        .or(`id.eq.${userId},parent_id.eq.${userId}`),
      supabase.from('memberships').select('*').eq('profile_id', userId),
      supabase
        .from('temp_membership_form_data')
        .select('*')
        .eq('parent_id', userId),
      supabase
        .from('temp_membership_form_data')
        .select('*')
        .eq('user_id', userId),
      supabase.from('profiles').select('*').eq('id', userId),
    ]);

    if (renewalQuery.error) {
      return retryable(`Error fetching renewals: ${renewalQuery.error.message}`);
    }
    if (memberQuery.error) {
      return retryable(
        `Error fetching memberships: ${memberQuery.error.message}`,
      );
    }
    if (tempChildQuery.error) {
      return retryable(
        `Error fetching temp child data: ${tempChildQuery.error.message}`,
      );
    }
    if (tempParentQuery.error) {
      return retryable(
        `Error fetching temp parent data: ${tempParentQuery.error.message}`,
      );
    }
    if (profileQuery.error) {
      return retryable(
        `Error fetching profile: ${profileQuery.error.message}`,
      );
    }

    const renewalData = renewalQuery.data || [];
    const memberData = memberQuery.data || [];
    const tempChildData = tempChildQuery.data || [];
    const tempParentData = tempParentQuery.data || [];
    const profile = profileQuery.data || [];

    if (profile.length === 0) {
      return nonRetryable(`No profile found for user ID: ${userId}`);
    }

    const hasRenewalSelections = Boolean(
      renewalData.length > 0 || renewalIdsFromMetadata.length > 0,
    );
    const hasExistingMembership = memberData.length > 0;
    const hasTempChildData = tempChildData.length > 0;
    const hasTempParentUpgrade = Boolean(
      tempParentData.length > 0 &&
        tempParentData[0].member_type === 'Regular' &&
        profile[0].member_type != null,
    );
    const isRenewalCheckout = Boolean(
      checkoutType === 'renewal' ||
        renewalIdsFromMetadata.length > 0 ||
        (!checkoutType &&
          hasRenewalSelections &&
          !hasTempChildData &&
          !hasTempParentUpgrade),
    );

    // ----- Branch: post-signup family-member add -----
    if (!isRenewalCheckout && hasTempChildData) {
      return await fulfillPostSignupFamilyMember({
        supabase,
        supabaseUrl: options.supabaseUrl,
        serviceRoleKey: options.serviceRoleKey,
        userId,
        sessionId: session.id,
        amountPaid,
        createdDate,
        tempChildRow: tempChildData[0],
      });
    }

    // ----- Branch: existing non-member parent activates Regular membership -----
    if (!isRenewalCheckout && hasTempParentUpgrade) {
      return await fulfillParentUpgrade({
        supabase,
        userId,
        sessionId: session.id,
        amountPaid,
        createdDate,
        tempParentRow: tempParentData[0],
        hasExistingMembership,
      });
    }

    // ----- Branch: renewal -----
    if (isRenewalCheckout) {
      return await fulfillRenewal({
        supabase,
        supabaseUrl: options.supabaseUrl,
        serviceRoleKey: options.serviceRoleKey,
        userId,
        session,
        amountPaid,
        createdDate,
        sessionCreatedIso,
        renewalData,
        renewalIdsFromMetadata,
      });
    }

    if (hasExistingMembership) {
      return nonRetryable(
        'Existing member checkout completed without renewal selections or staged membership changes.',
      );
    }

    // ----- Branch: new signup (individual / family / family-only / charter) -----
    return await fulfillNewSignup({
      supabase,
      supabaseUrl: options.supabaseUrl,
      serviceRoleKey: options.serviceRoleKey,
      userId,
      session,
      amountPaid,
      createdDate,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'error', message, retryable: true };
  }
}

// --- Branch: post-signup family-member add (originally-broken flow) ---
async function fulfillPostSignupFamilyMember(params: {
  supabase: SupabaseClient;
  supabaseUrl: string;
  serviceRoleKey: string;
  userId: string;
  sessionId: string;
  amountPaid: number;
  createdDate: Date;
  tempChildRow: any;
}): Promise<FulfillmentResult> {
  const {
    supabase,
    supabaseUrl,
    serviceRoleKey,
    userId,
    sessionId,
    amountPaid,
    createdDate,
    tempChildRow,
  } = params;

  const childData = {
    member_type: tempChildRow.member_type || null,
    membership_option: tempChildRow.membership_option || null,
    first_name: tempChildRow.first_name || null,
    middle_initial: tempChildRow.middle_initial || null,
    last_name: tempChildRow.last_name || null,
    suffix: tempChildRow.suffix || null,
    address_line1: tempChildRow.address_line1 || null,
    address_line2: tempChildRow.address_line2 || null,
    city: tempChildRow.city || null,
    state: tempChildRow.state || null,
    zip: tempChildRow.zip || null,
    country: tempChildRow.country || null,
    email: tempChildRow.email || null,
    disciplines: tempChildRow.disciplines || [],
    ama_number: tempChildRow.ama_number || null,
    birthdate: tempChildRow.birthdate || null,
    home_phone: tempChildRow.home_phone || null,
    cell_phone: tempChildRow.cell_phone || null,
    emergency_contact_name: tempChildRow.emergency_contact_name || null,
    emergency_contact_phone: tempChildRow.emergency_contact_phone || null,
    signature: tempChildRow.signature || null,
    date_signed: tempChildRow.date_signed || null,
    parent_id: tempChildRow.parent_id || userId,
  };

  const createProfileResponse = await fetch(
    `${supabaseUrl}/functions/v1/createUser`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        ...childData,
        password: 'password',
        from: 'membership',
      }),
    },
  );

  const createProfileResult = await createProfileResponse.json();

  if (!createProfileResponse.ok) {
    return nonRetryable(
      `Profile creation failed: ${
        createProfileResult.message ||
        createProfileResult.error ||
        createProfileResult.details ||
        'Unknown error'
      }`,
    );
  }

  const newChild = createProfileResult.user;
  if (!newChild?.id) {
    return nonRetryable('Profile creation failed: missing child profile id.');
  }

  // Idempotency gate: insert receipt FIRST (on the new child, per existing behavior).
  // If another path beat us to it the unique constraint short-circuits us.
  const receiptInsert = await supabase.from('membership_receipts').insert({
    profile_id: newChild.id,
    stripe_transaction_id: sessionId,
    amount_paid: amountPaid,
    date_created: createdDate.toISOString(),
  });

  if (receiptInsert.error) {
    if ((receiptInsert.error as any).code === PG_UNIQUE_VIOLATION) {
      return { status: 'already_fulfilled' };
    }
    return retryable(
      `Membership receipt insertion failed: ${receiptInsert.error.message}`,
    );
  }

  const { data: existingChildMembership, error: existingChildMembershipError } =
    await supabase
      .from('memberships')
      .select('id')
      .eq('profile_id', newChild.id)
      .limit(1);

  if (existingChildMembershipError) {
    return retryable(
      `Error fetching child membership data: ${existingChildMembershipError.message}`,
    );
  }

  if (!existingChildMembership || existingChildMembership.length === 0) {
    const expirationDate = new Date(createdDate);
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);

    const membershipResponse = await supabase.from('memberships').insert({
      profile_id: newChild.id,
      date_created: createdDate.toISOString(),
      expiration: expirationDate.toISOString(),
      last_modified: createdDate.toISOString(),
    });

    if (membershipResponse.error) {
      return retryable(
        `Membership insertion failed: ${membershipResponse.error.message}`,
      );
    }
  }

  await deleteTempMembershipRows(supabase, userId);

  return {
    status: 'fulfilled',
    message: 'New family member added successfully.',
  };
}

// --- Branch: existing non-member parent activates their own Regular membership ---
async function fulfillParentUpgrade(params: {
  supabase: SupabaseClient;
  userId: string;
  sessionId: string;
  amountPaid: number;
  createdDate: Date;
  tempParentRow: any;
  hasExistingMembership: boolean;
}): Promise<FulfillmentResult> {
  const {
    supabase,
    userId,
    sessionId,
    amountPaid,
    createdDate,
    tempParentRow,
    hasExistingMembership,
  } = params;

  // Idempotency gate: insert receipt FIRST.
  const receiptInsert = await supabase.from('membership_receipts').insert({
    profile_id: userId,
    stripe_transaction_id: sessionId,
    amount_paid: amountPaid,
    date_created: createdDate.toISOString(),
  });

  if (receiptInsert.error) {
    if ((receiptInsert.error as any).code === PG_UNIQUE_VIOLATION) {
      return { status: 'already_fulfilled' };
    }
    return retryable(
      `Membership receipt insertion failed: ${receiptInsert.error.message}`,
    );
  }

  if (!hasExistingMembership) {
    const expirationDate = new Date(createdDate);
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);

    const membershipResponse = await supabase.from('memberships').insert({
      profile_id: userId,
      date_created: createdDate.toISOString(),
      expiration: expirationDate.toISOString(),
      last_modified: createdDate.toISOString(),
    });

    if (membershipResponse.error) {
      return retryable(
        `Membership insertion failed: ${membershipResponse.error.message}`,
      );
    }
  }

  const updateResponse = await supabase
    .from('profiles')
    .update({
      ama_number: tempParentRow.ama_number,
      disciplines: tempParentRow.disciplines,
      member_type: tempParentRow.member_type,
    })
    .eq('id', userId);

  if (updateResponse.error) {
    return retryable(
      `Error updating profile: ${updateResponse.error.message}`,
    );
  }

  await deleteTempMembershipRows(supabase, userId);

  return {
    status: 'fulfilled',
    message: 'Membership activated successfully.',
  };
}

// --- Branch: renewal (self and/or family) ---
async function fulfillRenewal(params: {
  supabase: SupabaseClient;
  supabaseUrl: string;
  serviceRoleKey: string;
  userId: string;
  session: StripeCheckoutSession;
  amountPaid: number;
  createdDate: Date;
  sessionCreatedIso: string;
  renewalData: any[];
  renewalIdsFromMetadata: string[];
}): Promise<FulfillmentResult> {
  const {
    supabase,
    supabaseUrl,
    serviceRoleKey,
    userId,
    session,
    amountPaid,
    createdDate,
    sessionCreatedIso,
    renewalData,
    renewalIdsFromMetadata,
  } = params;

  const renewalIds =
    renewalIdsFromMetadata.length > 0
      ? renewalIdsFromMetadata
      : renewalData.map((renewal) => renewal.id);

  if (renewalIds.length === 0) {
    return nonRetryable(
      'No renewal selections found for this checkout session.',
    );
  }

  const expectedRenewalCount = session.metadata?.renewal_count;
  if (
    expectedRenewalCount &&
    parseInt(expectedRenewalCount) !== renewalIds.length
  ) {
    return nonRetryable(
      `Billing mismatch for renewal checkout. Stripe charged for ${expectedRenewalCount} renewals, but fulfillment found ${renewalIds.length}. Session ID: ${session.id}, User ID: ${userId}`,
    );
  }

  // Idempotency gate: insert receipt FIRST. Renewals attribute the receipt to
  // the parent (userId), matching existing behavior.
  const receiptInsert = await supabase.from('membership_receipts').insert({
    profile_id: userId,
    stripe_transaction_id: session.id,
    amount_paid: amountPaid,
    date_created: createdDate.toISOString(),
  });

  if (receiptInsert.error) {
    if ((receiptInsert.error as any).code === PG_UNIQUE_VIOLATION) {
      return { status: 'already_fulfilled' };
    }
    return retryable(
      `Error inserting membership receipt: ${receiptInsert.error.message}`,
    );
  }

  const expirations: Array<{
    id: string;
    expiration: string;
    name: string;
    birthdate: string;
    disciplines: string[];
    email: string;
  }> = [];

  const originalMembershipState = new Map<
    string,
    { expiration: string; last_modified: string | null }
  >();
  const successfulUpdates: string[] = [];

  for (const renewalId of renewalIds) {
    const { data: membershipData, error: membershipError } = await supabase
      .from('memberships')
      .select('expiration, last_modified')
      .eq('profile_id', renewalId);

    if (membershipError) {
      return retryable(
        `Error fetching membership data for renewal: ${membershipError.message}`,
      );
    }
    if (!membershipData || membershipData.length === 0) {
      return nonRetryable(
        `No membership data found for renewal id ${renewalId}.`,
      );
    }

    originalMembershipState.set(renewalId, {
      expiration: membershipData[0].expiration,
      last_modified: membershipData[0].last_modified || null,
    });

    const currentExpiration = new Date(membershipData[0].expiration);
    const lastModified = membershipData[0].last_modified
      ? new Date(membershipData[0].last_modified)
      : null;
    const alreadyUpdatedForSession =
      lastModified !== null && lastModified >= createdDate;
    let newExpiration = new Date(currentExpiration);

    if (!alreadyUpdatedForSession) {
      newExpiration = new Date();
      if (currentExpiration < new Date()) {
        newExpiration.setFullYear(newExpiration.getFullYear() + 1);
      } else {
        newExpiration.setTime(currentExpiration.getTime());
        newExpiration.setFullYear(newExpiration.getFullYear() + 1);
      }

      const { error: updateRenewalError } = await supabase
        .from('memberships')
        .update({
          expiration: newExpiration.toISOString(),
          last_modified: sessionCreatedIso,
        })
        .eq('profile_id', renewalId);

      if (updateRenewalError) {
        for (const id of successfulUpdates) {
          const originalState = originalMembershipState.get(id)!;
          await supabase
            .from('memberships')
            .update({
              expiration: originalState.expiration,
              last_modified: originalState.last_modified,
            })
            .eq('profile_id', id);
        }
        return retryable(
          `Error updating renewal expiration: ${updateRenewalError.message}`,
        );
      }

      successfulUpdates.push(renewalId);
    }

    expirations.push({
      id: renewalId,
      expiration: newExpiration.toISOString(),
      name: '',
      birthdate: '',
      disciplines: [],
      email: '',
    });
  }

  let profile_email = '';
  for (const expiration of expirations) {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, birthdate, disciplines')
      .eq('id', expiration.id);

    if (profileError) {
      return retryable(
        `Error fetching profile data: ${profileError.message}`,
      );
    }
    if (!profileData || profileData.length === 0) {
      return nonRetryable(`No profile data found for id ${expiration.id}.`);
    }

    if (profileData[0].id === userId) {
      profile_email = profileData[0].email;
    }

    expiration.name = `${profileData[0].first_name} ${profileData[0].last_name}`;
    expiration.birthdate = profileData[0].birthdate;
    expiration.disciplines = profileData[0].disciplines;
    expiration.email = profileData[0].email;
  }

  if (profile_email === '' && expirations.length > 0) {
    profile_email = expirations[0].email;
  }

  await deleteRenewalRows(supabase, userId, renewalIds);

  const emailHtmlContent = renewalEmailHtml(expirations, session.receipt_url);
  await sendEmailSafely(
    {
      to: ['secretary@ama-d14.org', profile_email],
      subject: 'Membership Renewal',
      html: emailHtmlContent,
    },
    supabaseUrl,
    serviceRoleKey,
  );

  return {
    status: 'fulfilled',
    message: 'Membership renewed successfully.',
  };
}

// --- Branch: new signup (individual / family / family-only / charter) ---
async function fulfillNewSignup(params: {
  supabase: SupabaseClient;
  supabaseUrl: string;
  serviceRoleKey: string;
  userId: string;
  session: StripeCheckoutSession;
  amountPaid: number;
  createdDate: Date;
}): Promise<FulfillmentResult> {
  const {
    supabase,
    supabaseUrl,
    serviceRoleKey,
    userId,
    session,
    amountPaid,
    createdDate,
  } = params;

  const { data: membershipData, error: fetchError } = await supabase
    .from('temp_membership_form_data')
    .select('*')
    .eq('user_id', userId);

  if (fetchError) {
    return retryable(
      `Error fetching temp membership data: ${fetchError.message}`,
    );
  }
  if (!membershipData || membershipData.length === 0) {
    return nonRetryable('No data found in temp_membership_form_data.');
  }

  let organizationId: number | null = null;
  if (membershipData[0].member_type === 'Charter') {
    const { data: organizationData, error: organizationError } = await supabase
      .from('organizations')
      .select('id')
      .eq('organization_user_id', userId);

    if (organizationError) {
      return retryable(
        `Error fetching organization data: ${organizationError.message}`,
      );
    }
    if (!organizationData || organizationData.length === 0) {
      return nonRetryable('No organization found for charter member');
    }
    organizationId = organizationData[0].id;
  }

  // Idempotency gate: insert receipt FIRST. New-signup receipts attribute to
  // the parent (userId), matching existing behavior.
  const receiptInsert = await supabase.from('membership_receipts').insert({
    profile_id: userId,
    stripe_transaction_id: session.id,
    amount_paid: amountPaid,
    date_created: createdDate.toISOString(),
  });

  if (receiptInsert.error) {
    if ((receiptInsert.error as any).code === PG_UNIQUE_VIOLATION) {
      return { status: 'already_fulfilled' };
    }
    return retryable(
      `Membership receipt insertion failed: ${receiptInsert.error.message}`,
    );
  }

  const profileData = {
    member_type: membershipData[0].member_type || null,
    membership_option: membershipData[0].membership_option || null,
    first_name: membershipData[0].first_name || null,
    middle_initial: membershipData[0].middle_initial || null,
    last_name: membershipData[0].last_name || null,
    suffix: membershipData[0].suffix || null,
    address_line1: membershipData[0].address_line1 || null,
    address_line2: membershipData[0].address_line2 || null,
    city: membershipData[0].city || null,
    state: membershipData[0].state || null,
    zip: membershipData[0].zip || null,
    country: membershipData[0].country || null,
    email: membershipData[0].email || null,
    disciplines: membershipData[0].disciplines || [],
    ama_number: membershipData[0].ama_number || null,
    birthdate: membershipData[0].birthdate || null,
    home_phone: membershipData[0].home_phone || null,
    cell_phone: membershipData[0].cell_phone || null,
    emergency_contact_name: membershipData[0].emergency_contact_name || null,
    emergency_contact_phone: membershipData[0].emergency_contact_phone || null,
    signature: membershipData[0].signature || null,
    date_signed: membershipData[0].date_signed || null,
    organization_id: organizationId,
  };

  const { error: updateError } = await supabase
    .from('profiles')
    .update(profileData)
    .eq('id', userId);

  if (updateError) {
    return retryable(`Error updating profile: ${updateError.message}`);
  }

  const { data: childrenData, error: childrenError } = await supabase
    .from('profiles')
    .select('*')
    .eq('parent_id', userId);

  if (childrenError) {
    return retryable(
      `Error fetching children data: ${childrenError.message}`,
    );
  }

  const expirationDate = new Date(createdDate);
  expirationDate.setFullYear(expirationDate.getFullYear() + 1);

  const childIds = (childrenData || []).map((child: any) => child.id);
  const idsToBeAdded: string[] = [...childIds];
  if (membershipData[0].member_type !== 'Family') {
    idsToBeAdded.push(userId);
  }

  for (const id of idsToBeAdded) {
    const { data: existingMembership, error: existingMembershipError } =
      await supabase
        .from('memberships')
        .select('id')
        .eq('profile_id', id)
        .limit(1);

    if (existingMembershipError) {
      return retryable(
        `Error checking existing membership data: ${existingMembershipError.message}`,
      );
    }

    if (existingMembership && existingMembership.length > 0) continue;

    const membershipResponse = await supabase.from('memberships').insert({
      profile_id: id,
      date_created: createdDate.toISOString(),
      expiration: expirationDate.toISOString(),
      last_modified: createdDate.toISOString(),
    });

    if (membershipResponse.error) {
      return retryable(
        `Membership insertion failed: ${membershipResponse.error.message}`,
      );
    }
  }

  await deleteTempMembershipRows(supabase, userId);

  const emailHtmlContent = newSignupEmailHtml(
    profileData,
    childrenData || [],
    session.receipt_url,
  );
  await sendEmailSafely(
    {
      to: ['secretary@ama-d14.org', profileData.email as string],
      subject: 'New Membership Signup',
      html: emailHtmlContent,
    },
    supabaseUrl,
    serviceRoleKey,
  );

  return {
    status: 'fulfilled',
    message: 'Profile, membership, and receipt processed successfully.',
  };
}

// --- Cleanup helpers ---

async function deleteTempMembershipRows(
  supabase: SupabaseClient,
  userId: string,
) {
  const { error: userTempError } = await supabase
    .from('temp_membership_form_data')
    .delete()
    .eq('user_id', userId);
  if (userTempError) {
    console.error(
      `Error deleting user temp membership data: ${userTempError.message}`,
    );
  }

  const { error: familyTempError } = await supabase
    .from('temp_membership_form_data')
    .delete()
    .eq('parent_id', userId);
  if (familyTempError) {
    console.error(
      `Error deleting family temp membership data: ${familyTempError.message}`,
    );
  }
}

async function deleteRenewalRows(
  supabase: SupabaseClient,
  userId: string,
  renewalIds: string[] = [],
) {
  if (renewalIds.length > 0) {
    const { error } = await supabase
      .from('renewals')
      .delete()
      .in('id', renewalIds);
    if (error) {
      console.error(`Error deleting renewals data: ${error.message}`);
    }
    return;
  }

  const { error } = await supabase
    .from('renewals')
    .delete()
    .or(`id.eq.${userId},parent_id.eq.${userId}`);
  if (error) {
    console.error(`Error deleting renewals data: ${error.message}`);
  }
}

// --- Email helper ---

async function sendEmailSafely(
  payload: { to: string[]; subject: string; html: string },
  supabaseUrl: string,
  serviceRoleKey: string,
) {
  try {
    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('Email sending failed:', errorText);
    }
  } catch (error) {
    console.error('Email request failed:', error);
  }
}

// --- Result helpers ---

function retryable(message: string): FulfillmentResult {
  return { status: 'error', message, retryable: true };
}

function nonRetryable(message: string): FulfillmentResult {
  return { status: 'error', message, retryable: false };
}

// --- Email HTML (preserved from previous inline implementation) ---

function renewalEmailHtml(
  expirations: Array<{
    name: string;
    expiration: string;
    birthdate: string;
    disciplines: string[];
  }>,
  receiptUrl: string | undefined,
): string {
  return `
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <header style="text-align: center; margin-bottom: 20px;">
        <img src="https://ama-d14.web.app/assets/images/d14_logo.png" alt="D14 Logo" style="max-width: 200px; height: auto;">
          </header>
          <main style="background-color: #f9f9f9; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h1 style="color: #333; font-size: 24px; margin-bottom: 20px; text-align: center;">Membership Renewal</h1>
          <p style="margin-bottom: 15px;">Membership has been renewed for the following users:</p>
          <ul style="list-style-type: none; padding: 0;">
          ${expirations
            .map(
              (expiration) => `
          <li style="background-color: #fff; padding: 10px; margin-bottom: 10px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <strong>${expiration.name}</strong> - New Expiration: ${new Date(
                expiration.expiration,
              ).toLocaleDateString()}<br>
          <strong>Birthdate:</strong> ${new Date(
            expiration.birthdate,
          ).toLocaleDateString()}<br>
          <strong>Disciplines:</strong> ${expiration.disciplines.join(', ')}
          </li>
          `,
            )
            .join('')}
          </ul>
          <p style="margin-top: 20px;">
        D14 remains on top of ORV and land-use issues, both environmentally and legislatively, by having members on several Michigan boards and in constant contact with the Michigan State Legislature.
          </p>
          <p>
        As a membership-driven organization, D14 strives to bring the finest events to our members - both the riders and the clubs/organizers. Please present proof of active membership at every event - your card, a photo or screenshot, or simply log in to www.ama-d14.org and your membership status will be confirmed. AMA membership is also required for participation.
          </p>
          <p>
        Lost/destroyed cards will be replaced at no cost. Please email secretary@ama-d14.org to request a replacement. If you have provided an email address, you will receive an email reminder to renew when your membership gets close to expiring. You may also elect to use the auto-renew feature.
          </p>
          <p>
        See you at the races!
          </p>
          <br>
          <br>
        You can find your receipt from this transaction <a href="https://dashboard.stripe.com/payments/${receiptUrl ?? ''}">here</a>.
          </main>
          <footer style="text-align: center; margin-top: 20px; font-size: 14px; color: #666;">
          <p>Thank you for renewing your D14 membership! If you have any questions, please contact us.</p>
          <p>&copy; 2023 D14. All rights reserved.</p>
          </footer>
        </body>`;
}

function newSignupEmailHtml(
  profileData: any,
  childrenData: any[],
  receiptUrl: string | undefined,
): string {
  const childrenEmailContent = `
        <p style="margin-bottom: 15px;">The following family members have also been added:</p>
        <ul style="list-style-type: none; padding: 0;">
          ${childrenData
            .map(
              (child) => `
            <li style="background-color: #fff; padding: 10px; margin-bottom: 10px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <strong>${child.first_name} ${child.last_name}</strong>
            </li>
          `,
            )
            .join('')}
        </ul>`;

  return `
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <header style="text-align: center; margin-bottom: 20px;">
          <img src="https://ama-d14.web.app/assets/images/d14_logo.png" alt="D14 Logo" style="max-width: 200px; height: auto;">
        </header>
        <main style="background-color: #f9f9f9; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #333; font-size: 24px; margin-bottom: 20px; text-align: center;">New Membership Signup</h1>
            <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 10px 0;"><strong>First Name:</strong></td>
                    <td style="padding: 10px 0;">${profileData.first_name}</td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 10px 0;"><strong>Last Name:</strong></td>
                    <td style="padding: 10px 0;">${profileData.last_name}</td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 10px 0;"><strong>Email:</strong></td>
                    <td style="padding: 10px 0;">${profileData.email}</td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 10px 0;"><strong>Address:</strong></td>
                    <td style="padding: 10px 0;">${profileData.address_line1}, ${profileData.city}, ${profileData.state}, ${profileData.zip}, ${profileData.country}</td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 10px 0;"><strong>Phone:</strong></td>
                    <td style="padding: 10px 0;">${profileData.cell_phone || profileData.home_phone}</td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 10px 0;"><strong>Disciplines:</strong></td>
                    <td style="padding: 10px 0;">${profileData.disciplines}</td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 10px 0;"><strong>Membership Type:</strong></td>
                    <td style="padding: 10px 0;">${profileData.member_type}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0;"><strong>AMA Number:</strong></td>
                    <td style="padding: 10px 0;">${profileData.ama_number}</td>
                </tr>
            </table>
            ${childrenData.length > 0 ? childrenEmailContent : ''}
        </main>
          <p style="margin-top: 20px;">
        D14 remains on top of ORV and land-use issues, both environmentally and legislatively, by having members on several Michigan boards and in constant contact with the Michigan State Legislature.
          </p>
          <p>
        As a membership-driven organization, D14 strives to bring the finest events to our members - both the riders and the clubs/organizers. Please present proof of active membership at every event - your card, a photo or screenshot, or simply log in to www.ama-d14.org and your membership status will be confirmed. AMA membership is also required for participation.
          </p>
          <p>
        Lost/destroyed cards will be replaced at no cost. Please email secretary@ama-d14.org to request a replacement. If you have provided an email address, you will receive an email reminder to renew when your membership gets close to expiring. You may also elect to use the auto-renew feature.
          </p>
          <p>
        See you at the races!
          </p>
          <br>
          <br>
        You can find your receipt from this transaction <a href="https://dashboard.stripe.com/payments/${receiptUrl ?? ''}">here</a>.
        <footer style="text-align: center; margin-top: 20px; font-size: 14px; color: #666;">
            <p>Thank you for joining D14! If you have any questions, please contact us.</p>
            <p>&copy; 2023 D14. All rights reserved.</p>
        </footer>
      </body>`;
}
