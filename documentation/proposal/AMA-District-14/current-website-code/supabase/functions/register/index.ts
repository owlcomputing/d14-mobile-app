import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    // Handle preflight (OPTIONS) request for CORS
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
      return new Response(JSON.stringify({ error: 'Invalid request method' }), {
        status: 405,
        headers: {
          'Access-Control-Allow-Origin': '*', // CORS header
        },
      });
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

    const { email, password } = body;

    // Check if email and password are provided
    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*', // CORS header
        },
      });
    }

    const SUPABASE_URL = "http://127.0.0.1:54321";
    const SUPABASE_SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2Y3ZpeGRnaGJsaG1vZWh3bm5wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxOTM0MDYzNywiZXhwIjoyMDM0OTE2NjM3fQ.d4IDPV24lSWk0cFqiv27VWp9zg7uISvMfqG5AEnbya8";

    // Create the user in Supabase Auth with email and password
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        email: email,
        password: password,
      }),
    });

    if (!res.ok) {
      const userError = await res.json();
      return new Response(JSON.stringify({ error: userError }), {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*', // CORS header
        },
      });
    }

    const user = await res.json();

    // Return success with created user info
    return new Response(JSON.stringify({ user }), {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*', // CORS header
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*', // CORS header
      },
    });
  }
}, {
  isPublic: true,
});
