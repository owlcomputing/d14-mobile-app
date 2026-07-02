import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'; // Correct module URL

// Random password generator
function generatePassword(length: number): string {
  let result = '';
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

// Initialize Supabase client
const SUPABASE_URL = 'https://qxoroicvatularpyltbx.supabase.co';
const SUPABASE_SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4b3JvaWN2YXR1bGFycHlsdGJ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMjAyNDM3MiwiZXhwIjoyMDQ3NjAwMzcyfQ.Cixp56gugUs6c5OOnNZiZuXH4L-XFZrZfwCZ5OH2HJw';
const supabase = createClient(SUPABASE_URL, SUPABASE_SUPABASE_SERVICE_ROLE_KEY);

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
        console.log(body);
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*', // CORS header
          },
        });
      }

      const {
        email,
        first_name,
        last_name,
        middle_initial,
        suffix,
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
        membership_option,
        emergency_contact_name,
        emergency_contact_phone,
        d14_number,
        last_modified,
        expiration,
        date_created,
        child,
        id,
      } = body;

      const newEmail = email;

      const isChild: boolean = child === 'true';
      let parentID: string | null = null;

      const userID = id;

      let user = null;

      const parentEmail =
        newEmail.split('@')[0].split('+')[0] + '@' + newEmail.split('@')[1];

      if (isChild) {
        const { data: parentData, error: parentError } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', parentEmail);

        if (parentError) {
          return new Response(JSON.stringify({ error: parentError.message }), {
            status: 400,
            headers: {
              'Access-Control-Allow-Origin': '*',
            },
          });
        }

        if (parentData && parentData.length > 0) {
          parentID = parentData[0].id;
        }
      }

      if (!userID) {
        const { data: signUpData, error: signUpError } =
          await supabase.auth.admin.createUser({
            email: newEmail,
            password: generatePassword(12),
            email_confirm: false,
            user_metadata: {
              first_name: first_name || null,
              last_name: last_name || null,
              middle_initial: middle_initial || null,
              suffix: suffix || null,
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
              membership_option: membership_option || null,
              emergency_contact_name: emergency_contact_name || null,
              emergency_contact_phone: emergency_contact_phone || null,
              d14_number: d14_number || null,
              last_modified: last_modified || null,
              expiration: expiration || null,
              date_created: date_created || null,
              parent_id: parentID || null,
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

        console.log('SIGN UP DATA', signUpData);

        user = signUpData.user;
      }

      if (user == null) {
        user = { id: userID };
      }

      const { error: profileError } = await supabase.from('profiles').insert([
        {
          id: user.id,
          email: newEmail,
          first_name,
          last_name,
          middle_initial,
          suffix,
          member_type,
          address_line1,
          address_line2,
          city,
          state,
          zip,
          country,
          disciplines,
          ama_number,
          birthdate: birthdate === '' ? null : birthdate,
          home_phone,
          cell_phone,
          membership_option,
          emergency_contact_name,
          emergency_contact_phone,
          d14_number,
          last_modified,
          parent_id: parentID,
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

      const { error: membershipError } = await supabase
        .from('memberships')
        .insert([
          {
            profile_id: user.id, // Use the user's ID from the signup process
            date_created: date_created || new Date().toISOString(),
            expiration: expiration || new Date().toISOString(),
            last_modified: last_modified || new Date().toISOString(),
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
