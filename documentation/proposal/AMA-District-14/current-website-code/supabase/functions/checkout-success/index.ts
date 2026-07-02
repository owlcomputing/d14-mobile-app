import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'; // Correct module URL

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const SupabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Create Supabase client
const supabase = createClient(supabaseUrl, SupabaseServiceKey);

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not set.');
}

const emailCloudFunctionUrl = `${supabaseUrl}/functions/v1/emails`;

serve(async (req: Request): Promise<Response> => {
  console.log('Request received');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const event = await req.json();
    const session = event.data.object;
    const userId = session.metadata.user_id; // Fetch user ID from metadata
    console.log('User ID from metadata:', userId);

    let isMember = false;

    // Fetch data from memberships table to see if this is a renewal
    const { data: renewalData, error: renewalError } = await supabase
      .from('renewals')
      .select('*')
      .or(`id.eq.${userId},parent_id.eq.${userId}`);

    if (renewalError) {
      throw new Error(
        `Error fetching membership data: ${renewalError.message}`
      );
    }

    const { data: memberData, error: memberError } = await supabase
      .from('memberships')
      .select('*')
      .eq('profile_id', userId);

    if (memberError) {
      throw new Error(`Error fetching membership data: ${memberError.message}`);
    }

    const { data: tempChildData, error: tempChildError } = await supabase
      .from('temp_membership_form_data')
      .select('*')
      .eq('parent_id', userId);

    if (tempChildError) {
      throw new Error(
        `Error fetching temp membership data: ${tempChildError.message}`
      );
    }

    const { data: tempParentData, error: tempParentError } = await supabase
      .from('temp_membership_form_data')
      .select('*')
      .eq('user_id', userId);

    if (tempParentError) {
      throw new Error(
        `Error fetching temp membership data: ${tempParentError.message}`
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId);

    if (profileError) {
      throw new Error(`Error fetching profile data: ${profileError.message}`);
    }

    if (
      (renewalData && renewalData.length > 0) ||
      (memberData && memberData.length > 0) ||
      (tempChildData && tempChildData.length > 0) ||
      (tempParentData &&
        tempParentData.length > 0 &&
        tempParentData[0].member_type == 'Regular' &&
        profile[0].member_type != null)
    ) {
      isMember = true;
      if (renewalData) {
        console.log('Existing member found:', renewalData);
      }
    }

    // Handle renewal case OR new family member post-signup
    if (isMember) {
      if (tempChildData && tempChildData.length > 0) {
        console.log('Post-signup family member:', tempChildData);

        // Prepare profileData for update
        const childData = {
          member_type: tempChildData[0].member_type || null,
          membership_option: tempChildData[0].membership_option || null,
          first_name: tempChildData[0].first_name || null,
          middle_initial: tempChildData[0].middle_initial || null,
          last_name: tempChildData[0].last_name || null,
          suffix: tempChildData[0].suffix || null,
          address_line1: tempChildData[0].address_line1 || null,
          address_line2: tempChildData[0].address_line2 || null,
          city: tempChildData[0].city || null,
          state: tempChildData[0].state || null,
          zip: tempChildData[0].zip || null,
          country: tempChildData[0].country || null,
          email: tempChildData[0].email || null,
          disciplines: tempChildData[0].disciplines || [], // Array
          ama_number: tempChildData[0].ama_number || null,
          birthdate: tempChildData[0].birthdate || null,
          home_phone: tempChildData[0].home_phone || null,
          cell_phone: tempChildData[0].cell_phone || null,
          emergency_contact_name:
            tempChildData[0].emergency_contact_name || null,
          emergency_contact_phone:
            tempChildData[0].emergency_contact_phone || null,
          signature: tempChildData[0].signature || null,
          date_signed: tempChildData[0].date_signed || null,
          parent_id: tempChildData[0].parent_id || userId,
        };

        // call createUser cloud function to create the new family member profile
        const requestData = {
          ...childData,
          password: 'password',
          from: 'membership',
        };
        const createProfileResponse = await fetch(
          `${supabaseUrl}/functions/v1/createUser`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${SupabaseServiceKey}`,
            },
            body: JSON.stringify(requestData),
          }
        );

        if (!createProfileResponse.ok) {
          const createProfileError = await createProfileResponse.json();
          throw new Error(
            `Profile creation failed: ${createProfileError.message}`
          );
        }

        // delete the temp_membership_form_data record
        const { error: deleteTempError } = await supabase
          .from('temp_membership_form_data')
          .delete()
          .eq('parent_id', userId);

        if (deleteTempError) {
          throw new Error(
            `Error deleting temp membership data: ${deleteTempError.message}`
          );
        }

        console.log('Profile created successfully.');
        // fetch the profile from profiles
        const { data: childProfileData, error: childProfileError } =
          await supabase.from('profiles').select('id').eq('parent_id', userId);

        if (childProfileError) {
          throw new Error(
            `Error fetching child profile data: ${childProfileError.message}`
          );
        }

        let newChild = null;

        if (!childProfileData || childProfileData.length === 0) {
          throw new Error('No child profile data found.');
        }

        if (childProfileData.length > 1) {
          for (const child of childProfileData) {
            const { data: membershipData, error: membershipError } =
              await supabase
                .from('memberships')
                .select('*')
                .eq('profile_id', child.id);

            if (membershipError) {
              throw new Error(
                `Error fetching membership data for child: ${membershipError.message}`
              );
            }

            if (!membershipData || membershipData.length === 0) {
              // this is the new child profile
              newChild = child;
            }
          }
        } else if (childProfileData.length === 1) {
          newChild = childProfileData[0];
        }

        console.log('New child profile:', newChild);

        // Insert the membership data into the memberships table
        const creationDate = new Date(session.created * 1000);
        const expirationDate = new Date(creationDate);
        expirationDate.setFullYear(expirationDate.getFullYear() + 1);

        if (newChild) {
          const membershipResponse = await supabase.from('memberships').insert({
            profile_id: newChild.id,
            date_created: creationDate.toISOString(),
            expiration: expirationDate.toISOString(),
            last_modified: creationDate.toISOString(),
          });

          if (membershipResponse.error) {
            throw new Error(
              `Membership insertion failed: ${membershipResponse.error.message}`
            );
          }

          const receiptResponse = await supabase
            .from('membership_receipts')
            .insert({
              profile_id: newChild.id,
              stripe_transaction_id: session.id,
              amount_paid: session.amount_total / 100,
              date_created: creationDate.toISOString(),
            });

          if (receiptResponse.error) {
            throw new Error(
              `Membership receipt insertion failed: ${receiptResponse.error.message}`
            );
          }

          return new Response(
            JSON.stringify({
              message: 'New family member added successfully.',
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          );
        }
      } else if (tempParentData && tempParentData.length > 0) {
        // Insert the membership data into the memberships table
        const createdDate = new Date(session.created * 1000);
        const expirationDate = createdDate;
        expirationDate.setFullYear(expirationDate.getFullYear() + 1);

        const membershipResponse = await supabase.from('memberships').insert({
          profile_id: userId,
          date_created: createdDate.toISOString(),
          expiration: expirationDate.toISOString(),
          last_modified: createdDate.toISOString(),
        });

        if (membershipResponse.error) {
          throw new Error(
            `Membership insertion failed: ${membershipResponse.error.message}`
          );
        }

        // Update the profile with the ama number and disciplines
        const updateResponse = await supabase
          .from('profiles')
          .update({
            ama_number: tempParentData[0].ama_number,
            disciplines: tempParentData[0].disciplines,
            member_type: tempParentData[0].member_type,
          })
          .eq('id', userId);

        if (updateResponse.error) {
          throw new Error(
            `Error updating profile: ${updateResponse.error.message}`
          );
        }

        const receiptResponse = await supabase
          .from('membership_receipts')
          .insert({
            profile_id: userId,
            stripe_transaction_id: session.id,
            amount_paid: session.amount_total / 100,
            date_created: createdDate.toISOString(),
          });

        if (receiptResponse.error) {
          throw new Error(
            `Membership receipt insertion failed: ${receiptResponse.error.message}`
          );
        }

        const tempResponse = await supabase
          .from('temp_membership_form_data')
          .delete()
          .eq('user_id', userId);

        if (tempResponse.error) {
          throw new Error(
            `Error deleting temp membership data: ${tempResponse.error.message}`
          );
        }

        return new Response(
          JSON.stringify({
            message: 'Family member added successfully.',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      let expirations = [];
      // get all renewing members with id = userId or parent_id = userId
      const { data: renewalsData, error: renewalsError } = await supabase
        .from('renewals')
        .select('*')
        .or(`id.eq.${userId},parent_id.eq.${userId}`);

      if (renewalsError) {
        throw new Error(
          `Error fetching renewals data: ${renewalsError.message}`
        );
      }

      if (!renewalsData || renewalsData.length === 0) {
        throw new Error('No renewals data found.');
      }
      console.log('Profiles renewing: ', renewalsData);

      let profile_email = '';
      // Update the expiration date for all the members
      for (const renewal of renewalsData) {
        // Get the current expiration date from memberships table
        const { data: membershipData, error: membershipError } = await supabase
          .from('memberships')
          .select('expiration')
          .eq('profile_id', renewal.id);

        if (membershipError) {
          throw new Error(
            `Error fetching membership data for renewal: ${membershipError.message}`
          );
        }
        if (!membershipData || membershipData.length === 0) {
          throw new Error('No membership data found.');
        }

        const currentExpiration = new Date(membershipData[0].expiration);
        const newExpiration = new Date();
        // If current expiration date is in the past, set new expiration to current date + 1 year, otherwise add 1 year to current expiration
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
            last_modified: new Date().toISOString(),
          })
          .eq('profile_id', renewal.id);

        if (updateRenewalError) {
          throw new Error(
            `Error updating renewal expiration: ${updateRenewalError.message}`
          );
        }

        expirations.push({
          id: renewal.id,
          expiration: newExpiration.toISOString(),
          name: '',
          birthdate: '',
          disciplines: [],
          email: '',
        });

        for (const expiration of expirations) {
          // get the name of the user from the profiles table
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, birthdate, disciplines')
            .eq('id', expiration.id);

          if (profileError) {
            throw new Error(
              `Error fetching profile data: ${profileError.message}`
            );
          }

          if (!profileData || profileData.length === 0) {
            throw new Error('No profile data found.');
          }

          if (profileData[0].id === userId) {
            profile_email = profileData[0].email;
          }

          expiration[
            'name'
          ] = `${profileData[0].first_name} ${profileData[0].last_name}`;
          expiration['birthdate'] = profileData[0].birthdate;
          expiration['disciplines'] = profileData[0].disciplines;
          expiration['email'] = profileData[0].email;
        }
      }

      // Insert membership receipt for renewal
      const createdDate = new Date(session.created * 1000);
      const amountPaid = session.amount_total / 100;

      const { error: receiptError } = await supabase
        .from('membership_receipts')
        .insert({
          profile_id: userId,
          stripe_transaction_id: session.id,
          amount_paid: amountPaid,
          date_created: createdDate.toISOString(),
        });

      if (receiptError) {
        throw new Error(
          `Error inserting membership receipt: ${receiptError.message}`
        );
      }

      console.log('Membership renewal receipt inserted successfully.');

      // Delete the renewals data from the table
      const { error: deleteRenewalsError } = await supabase
        .from('renewals')
        .delete()
        .or(`id.eq.${userId},parent_id.eq.${userId}`);

      if (deleteRenewalsError) {
        throw new Error(
          `Error deleting renewals data: ${deleteRenewalsError.message}`
        );
      }

      // get the names and expiration dates of the renewing members

      const emailHtmlContent = `
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
                expiration.expiration
              ).toLocaleDateString()}<br>
          <strong>Birthdate:</strong> ${new Date(
            expiration.birthdate
          ).toLocaleDateString()}<br>
          <strong>Disciplines:</strong> ${expiration.disciplines.join(', ')}
          </li>
          `
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
        You can find your receipt from this transaction <a href="https://dashboard.stripe.com/payments/${
          session.receipt_url
        }">here</a>.
          </main>
          <footer style="text-align: center; margin-top: 20px; font-size: 14px; color: #666;">
          <p>Thank you for renewing your D14 membership! If you have any questions, please contact us.</p>
          <p>&copy; 2023 D14. All rights reserved.</p>
          </footer>
        </body>`;

      if (profile_email === '') {
        profile_email = expirations[0].email;
      }

      // Call the email cloud function
      const emailResponse = await fetch(emailCloudFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SupabaseServiceKey}`,
        },
        body: JSON.stringify({
          to: ['secretary@ama-d14.org', profile_email],
          subject: 'Membership Renewal',
          html: emailHtmlContent,
        }),
      });

      if (!emailResponse.ok) {
        const emailError = await emailResponse.json();
        throw new Error(`Email sending failed: ${emailError.message}`);
      }

      console.log('Email sent successfully.');

      return new Response(
        JSON.stringify({ message: 'Membership renewed successfully.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Fetch data from temp_membership_form_data
    const { data: membershipData, error: fetchError } = await supabase
      .from('temp_membership_form_data')
      .select('*')
      .eq('user_id', userId);

    if (fetchError) {
      throw new Error(
        `Error fetching temp membership data: ${fetchError.message}`
      );
    }

    if (!membershipData || membershipData.length === 0) {
      throw new Error('No data found in temp_membership_form_data.');
    }

    // check for organization if they are a charter member
    let organizationId = null;
    if (membershipData[0].member_type === 'Charter') {
      const { data: organizationData, error: organizationError } =
        await supabase
          .from('organizations')
          .select('id')
          .eq('organization_user_id', userId);
      if (organizationError) {
        throw new Error(
          `Error fetching organization data: ${organizationError.message}`
        );
      }
      if (!organizationData || organizationData.length === 0) {
        throw new Error('No organization found for charter member');
      }
      organizationId = organizationData[0].id;
    }

    // Prepare profileData for update
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
      disciplines: membershipData[0].disciplines || [], // Array
      ama_number: membershipData[0].ama_number || null,
      birthdate: membershipData[0].birthdate || null,
      home_phone: membershipData[0].home_phone || null,
      cell_phone: membershipData[0].cell_phone || null,
      emergency_contact_name: membershipData[0].emergency_contact_name || null,
      emergency_contact_phone:
        membershipData[0].emergency_contact_phone || null,
      signature: membershipData[0].signature || null,
      date_signed: membershipData[0].date_signed || null,
      organization_id: organizationId || null,
    };

    // Update the record for the profile with this userId
    const { data: updateData, error: updateError } = await supabase
      .from('profiles')
      .update(profileData)
      .eq('id', userId)
      .select();

    if (updateError) {
      throw new Error(`Error updating profile: ${updateError.message}`);
    }

    console.log('Profile data updated:', updateData);

    // Get all children who signed up with parent
    const { data: childrenData, error: childrenError } = await supabase
      .from('profiles')
      .select('*')
      .eq('parent_id', userId);

    if (childrenError) {
      throw new Error(`Error fetching children data: ${childrenError.message}`);
    }

    const childrenEmailContent = `
        <p style="margin-bottom: 15px;">The following family members have also been added:</p>
        <ul style="list-style-type: none; padding: 0;">
          ${childrenData
            .map(
              (child) => `
            <li style="background-color: #fff; padding: 10px; margin-bottom: 10px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <strong>${child.first_name} ${child.last_name}</strong>
            </li>
          `
            )
            .join('')}
        </ul>`;

    // Prepare the email content
    const emailHtmlContent = `
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
                    <td style="padding: 10px 0;">${
                      profileData.address_line1
                    }, ${profileData.city}, ${profileData.state}, ${
      profileData.zip
    }, ${profileData.country}</td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 10px 0;"><strong>Phone:</strong></td>
                    <td style="padding: 10px 0;">${
                      profileData.cell_phone || profileData.home_phone
                    }</td>
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
        You can find your receipt from this transaction <a href="https://dashboard.stripe.com/payments/${
          session.receipt_url
        }">here</a>.
          </main>
        <footer style="text-align: center; margin-top: 20px; font-size: 14px; color: #666;">
            <p>Thank you for joining D14! If you have any questions, please contact us.</p>
            <p>&copy; 2023 D14. All rights reserved.</p>
        </footer>
      </body>`;

    const createdDate = new Date(session.created * 1000);
    const amountPaid = session.amount_total / 100;

    const expirationDate = new Date(createdDate);
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);

    // Call the email cloud function
    const emailResponse = await fetch(emailCloudFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SupabaseServiceKey}`,
      },
      body: JSON.stringify({
        to: ['secretary@ama-d14.org', profileData.email],
        subject: 'New Membership Signup',
        html: emailHtmlContent,
      }),
    });

    if (!emailResponse.ok) {
      const emailError = await emailResponse.json();
      throw new Error(`Email sending failed: ${emailError.message}`);
    }

    console.log('Email sent successfully.');

    const children = childrenData.map((child) => child.id);

    let idsToBeAdded = [...children];
    if (membershipData[0].member_type !== 'Family') {
      idsToBeAdded.push(userId);
    }

    // Insert the membership data into the memberships table
    for (const id of idsToBeAdded) {
      const membershipResponse = await supabase
        .from('memberships')
        .insert({
          profile_id: id,
          date_created: createdDate.toISOString(),
          expiration: expirationDate.toISOString(),
          last_modified: createdDate.toISOString(),
        })
        .select();

      if (membershipResponse.error) {
        throw new Error(
          `Membership insertion failed: ${membershipResponse.error.message}`
        );
      }

      console.log('Membership data inserted:', membershipResponse.data);
    }

    // Insert the membership receipt into the membership_receipts table
    const receiptResponse = await supabase
      .from('membership_receipts')
      .insert({
        profile_id: userId,
        stripe_transaction_id: session.id,
        amount_paid: amountPaid,
        date_created: createdDate.toISOString(),
      })
      .select();

    if (receiptResponse.error) {
      throw new Error(
        `Membership receipt insertion failed: ${receiptResponse.error.message}`
      );
    }

    console.log('Membership receipt data inserted:', receiptResponse.data);

    // Delete the temp_membership_form_data record
    const { error: deleteTempError } = await supabase
      .from('temp_membership_form_data')
      .delete()
      .eq('user_id', userId);

    if (deleteTempError) {
      throw new Error(
        `Error deleting temp membership data: ${deleteTempError.message}`
      );
    }

    return new Response(
      JSON.stringify({
        message: 'Profile, membership, and receipt processed successfully.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error processing request:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
