import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'; // Correct module URL

// Initialize Supabase client
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  'SUPABASE_SERVICE_ROLE_KEY'
)!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SUPABASE_SERVICE_ROLE_KEY);

function applyNullableFilter(query: any, column: string, value: unknown) {
  return value === null || value === undefined
    ? query.is(column, null)
    : query.eq(column, value);
}

serve(
  async (req) => {
    try {
      if (req.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      }

      if (req.method !== 'POST') {
        return new Response(
          JSON.stringify({ error: 'Invalid request method' }),
          {
            status: 405,
            headers: {
              'Access-Control-Allow-Origin': '*', // CORS header
            },
          }
        );
      }

      const bodyText = await req.text();
      let body;
      try {
        body = JSON.parse(bodyText);
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*', // CORS header
          },
        });
      }

      let fromMembershipForm = false;
      let existing_member: string = '';
      if (body.from) {
        fromMembershipForm = true;
        delete body.from;
      }
      if (body.existing_member) {
        existing_member = body.existing_member;
        delete body.existing_member;
      }

      const {
        email,
        password,
        first_name,
        last_name,
        member_type,
        address_line1,
        address_line2,
        city,
        state,
        zip,
        country,
        disciplines,
        ama_number,
        birthdate,
        home_phone,
        cell_phone,
        date_signed,
        membership_option,
        emergency_contact_name,
        emergency_contact_phone,
        signature,
        parent_id,
        date_created,
        expiration,
      } = body;

      let newEmail = email;

      if (parent_id) {
        let existingChildQuery = supabase
          .from('profiles')
          .select('id')
          .eq('parent_id', parent_id);

        existingChildQuery = applyNullableFilter(
          existingChildQuery,
          'first_name',
          first_name
        );
        existingChildQuery = applyNullableFilter(
          existingChildQuery,
          'last_name',
          last_name
        );
        existingChildQuery = applyNullableFilter(
          existingChildQuery,
          'birthdate',
          birthdate
        );

        const { data: existingChild, error: existingChildError } =
          await existingChildQuery.limit(1);

        if (existingChildError) {
          return new Response(
            JSON.stringify({
              error: 'Error fetching existing child profile',
              details: existingChildError.message,
            }),
            {
              status: 500,
              headers: {
                'Access-Control-Allow-Origin': '*',
              },
            }
          );
        }

        if (existingChild && existingChild.length > 0) {
          return new Response(
            JSON.stringify({
              user: { id: existingChild[0].id },
              alreadyExisted: true,
            }),
            {
              status: 200,
              headers: {
                'Access-Control-Allow-Origin': '*',
              },
            }
          );
        }
      }

      if (parent_id) {
        // Get the parent's information first
        const { data: parent, error: parentFetchError } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', parent_id)
          .single();

        if (parentFetchError) {
          return new Response(
            JSON.stringify({
              error: 'Error fetching parent profile',
              details: parentFetchError.message,
            }),
            {
              status: 500,
              headers: {
                'Access-Control-Allow-Origin': '*',
              },
            }
          );
        }

        // Get the parent's base email (in case they are also a child)
        const parentEmail = parent.email;
        const [parentLocalPart, parentDomain] = parentEmail.split('@');
        const baseLocalPart = parentLocalPart.split('+')[0]; // Extract base by splitting on '+'
        const baseEmail = `${baseLocalPart}@${parentDomain}`;

        // Query for all existing children of this parent to determine the next child number
        const { data: childrenData, error: childrenError } = await supabase
          .from('profiles')
          .select('email')
          .eq('parent_id', parent_id);

        if (childrenError) {
          return new Response(
            JSON.stringify({
              error: 'Error fetching children profiles',
              details: childrenError.message,
            }),
            {
              status: 500,
              headers: {
                'Access-Control-Allow-Origin': '*',
              },
            }
          );
        }

        // Loop through to find the lowest available +child<i> email
        // This matches the logic in updateUser function
        let childEmail = '';
        for (let i = 1; i <= (childrenData ? childrenData.length + 1 : 1); i++) {
          childEmail = `${baseLocalPart}+child${i}@${parentDomain}`;
          if (!childrenData || !childrenData.some((child) => child.email === childEmail)) {
            break;
          }
        }
        newEmail = childEmail;

        console.log('Creating child user:', {
          parentId: parent_id,
          parentEmail: parentEmail,
          baseEmail: baseEmail,
          childCount: childrenData?.length || 0,
          newEmail: newEmail,
          existingChildren: childrenData?.map(c => c.email)
        });
      }

      const { data: signUpData, error: signUpError } =
        await supabase.auth.admin.createUser({
          email: newEmail,
          password,
          email_confirm: true, // Automatically confirm email
          user_metadata: {
            first_name: first_name || null,
            last_name: last_name || null,
            member_type: member_type || null,
            address_line1: address_line1 || null,
            address_line2: address_line2 || null,
            city: city || null,
            state: state || null,
            zip: zip || null,
            country: country || null,
            disciplines: disciplines || null,
            ama_number: ama_number || null,
            birthdate: birthdate || null,
            home_phone: home_phone || null,
            cell_phone: cell_phone || null,
            date_signed: date_signed || null,
            membership_option: membership_option || null,
            emergency_contact_name: emergency_contact_name || null,
            emergency_contact_phone: emergency_contact_phone || null,
            signature: signature || null,
            parent_id: parent_id || null,
          },
        });

      if (signUpError) {
        return new Response(JSON.stringify({ error: signUpError.message }), {
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      const user = signUpData?.user;

      const { error: profileError } = await supabase.from('profiles').insert([
        {
          id: user.id,
          email: newEmail,
          first_name,
          last_name,
          member_type,
          address_line1,
          address_line2,
          city,
          state,
          zip,
          country,
          disciplines,
          ama_number,
          birthdate,
          home_phone,
          cell_phone,
          date_signed,
          membership_option,
          emergency_contact_name,
          emergency_contact_phone,
          signature,
          parent_id,
        },
      ]);

      if (profileError) {
        return new Response(
          JSON.stringify({
            error: 'Error inserting profile',
            details: profileError.message,
          }),
          {
            status: 500,
            headers: {
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }

      // Insert into memberships table
      if (!fromMembershipForm) {
        let existing_information = {
          date_created: '',
          expiration: '',
        };
        if (existing_member !== '') {
          // get existing membership date_created and expiration
          const { data: membershipData, error: membershipError } =
            await supabase
              .from('memberships')
              .select('date_created, expiration')
              .eq('profile_id', existing_member);

          if (membershipError) {
            return new Response(
              JSON.stringify({
                error: 'Error updating membership',
                details: membershipError.message,
              }),
              {
                status: 500,
                headers: {
                  'Access-Control-Allow-Origin': '*',
                },
              }
            );
          }
          existing_information = membershipData[0];

          // update membership_receipts table to replace the old profile_id with the new profile_id
          const { error: receiptError } = await supabase
            .from('membership_receipts')
            .update({ profile_id: user.id })
            .eq('profile_id', existing_member);

          if (receiptError) {
            return new Response(
              JSON.stringify({
                error: 'Error updating membership receipt',
                details: receiptError.message,
              }),
              {
                status: 500,
                headers: {
                  'Access-Control-Allow-Origin': '*',
                },
              }
            );
          }
        }

        const { data: membershipData, error: membershipError } = await supabase
          .from('memberships')
          .insert([
            {
              profile_id: user.id, // Use the user's ID from the signup process
              date_created: existing_information.date_created
                ? existing_information.date_created
                : date_created
                ? date_created
                : new Date().toISOString(),
              expiration: existing_information.expiration
                ? existing_information.expiration
                : expiration
                ? expiration
                : new Date(
                    new Date().setFullYear(new Date().getFullYear() + 1)
                  ).toISOString(),
              last_modified: new Date().toISOString(),
            },
          ]);

        if (membershipError) {
          return new Response(
            JSON.stringify({
              error: 'Error inserting membership',
              details: membershipError.message,
            }),
            {
              status: 500,
              headers: {
                'Access-Control-Allow-Origin': '*',
              },
            }
          );
        }

        let amountPaid = 0;
        switch (member_type) {
          case 'Regular':
            amountPaid = 15;
            break;
          case 'Charter':
            amountPaid = 25;
            break;
          case 'Comped':
            amountPaid = 0;
            break;
          default:
            amountPaid = 0; // Default to 0 if member_type is unrecognized
        }

        if (!existing_information.date_created) {
          const { data: receiptData, error: receiptError } = await supabase
            .from('membership_receipts')
            .insert([
              {
                profile_id: user.id,
                amount_paid: amountPaid,
                payment_method: 'cash/check',
                date_created: new Date().toISOString(),
              },
            ]);

          if (receiptError) {
            return new Response(
              JSON.stringify({
                error: 'Error inserting membership receipt',
                details: receiptError.message,
              }),
              {
                status: 500,
                headers: {
                  'Access-Control-Allow-Origin': '*',
                },
              }
            );
          }
        }
      }

      // Return success response

      return new Response(JSON.stringify({ user }), {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          details: error.message,
        }),
        {
          status: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  },
  {
    isPublic: true,
  }
);
