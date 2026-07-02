import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
// Initialize Supabase client
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  'SUPABASE_SERVICE_ROLE_KEY'
)!;

serve(
  async (req) => {
    try {
      // Handle preflight (OPTIONS) request for CORS
      if (req.method === 'OPTIONS') {
        console.log('Handling OPTIONS request for CORS');
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      }

      // Ensure the request method is DELETE
      if (req.method !== 'DELETE') {
        console.log(`Invalid request method: ${req.method}`);
        return new Response(
          JSON.stringify({ error: 'Invalid request method' }),
          { status: 405 }
        );
      }

      const bodyText = await req.text();
      console.log(`Request body received: ${bodyText}`);

      let body;
      try {
        body = JSON.parse(bodyText);
      } catch (err) {
        console.error('Error parsing JSON body:', err.message);
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400,
        });
      }

      const { profile_id } = body;
      if (!profile_id) {
        console.error('Missing profile ID');
        return new Response(JSON.stringify({ error: 'Missing profile ID' }), {
          status: 400,
        });
      }

      console.log(`Deleting auth user with profile ID: ${profile_id}`);

      // Step 1: Delete the auth user from the 'auth.users' table using Supabase Admin API
      console.log('Attempting to delete auth user...');
      const deleteUserRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users/${profile_id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${SUPABASE_SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: `${SUPABASE_SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const deleteResponseBody = await deleteUserRes.text();
      if (!deleteUserRes.ok) {
        console.error('Error deleting auth user:', deleteResponseBody);
        return new Response(
          JSON.stringify({
            error: 'Error deleting auth user',
            details: deleteResponseBody,
          }),
          { status: 500 }
        );
      }

      console.log('Auth user deleted successfully:', deleteResponseBody);

      // Step 2: The trigger will automatically delete the profile record from the 'profiles' table

      return new Response(
        JSON.stringify({
          message: 'Auth user and profile deleted successfully',
        }),
        {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    } catch (error) {
      console.error('Error processing request:', error.message);
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
  { isPublic: true }
);
