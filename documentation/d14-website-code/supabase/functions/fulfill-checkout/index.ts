// Sync checkout fulfillment, called from /secure/checkout/complete after the
// Stripe embedded checkout return-URL redirect. Requires the user's Supabase
// JWT and verifies that the requested session belongs to them before invoking
// the shared fulfillment logic.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fulfillCheckoutSession } from '../_shared/fulfillment.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not set.');
}

// Service-role client is used for the actual fulfillment writes (RLS bypass).
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function retrieveStripeSession(sessionId: string) {
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${sessionId}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${stripeSecretKey}` },
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe session retrieve failed (${res.status}): ${text}`);
  }
  return await res.json();
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ status: 'error', message: 'Method not allowed', retryable: false }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      },
    );
  }

  // Authenticate: extract user from JWT in Authorization header.
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return new Response(
      JSON.stringify({ status: 'error', message: 'Missing Authorization bearer token', retryable: false }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      },
    );
  }

  // Validate the JWT against Supabase auth.
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return new Response(
      JSON.stringify({ status: 'error', message: 'Invalid or expired session', retryable: false }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      },
    );
  }
  const authedUserId = userData.user.id;

  let body: { session_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ status: 'error', message: 'Invalid JSON body', retryable: false }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
  const sessionId = body?.session_id;
  if (!sessionId || typeof sessionId !== 'string') {
    return new Response(
      JSON.stringify({ status: 'error', message: 'session_id is required', retryable: false }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }

  let session: any;
  try {
    session = await retrieveStripeSession(sessionId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ status: 'error', message, retryable: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  }

  // Authorization: the session must belong to the authenticated user.
  if (session?.metadata?.user_id !== authedUserId) {
    console.warn(
      'Session ownership mismatch:',
      'authed=',
      authedUserId,
      'session.metadata.user_id=',
      session?.metadata?.user_id,
    );
    return new Response(
      JSON.stringify({ status: 'error', message: 'Forbidden', retryable: false }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      },
    );
  }

  const result = await fulfillCheckoutSession(supabase, session, {
    supabaseUrl,
    serviceRoleKey: supabaseServiceKey,
  });

  // Always 200 — the client interprets the `status` field.
  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
});
