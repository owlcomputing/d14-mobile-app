// Webhook backstop for Stripe `checkout.session.completed` events.
// Sync fulfillment runs via the `fulfill-checkout` function. This one stays
// to catch closed-tab cases, async-confirmation payments (ACH/SEPA), and any
// network drops between Stripe and the client. Both paths share fulfillment.ts;
// idempotency is enforced by the unique constraint on
// membership_receipts.stripe_transaction_id.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fulfillCheckoutSession } from '../_shared/fulfillment.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not set.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header) return false;

  // Header format: t=<timestamp>,v1=<sig>,v1=<sig>,...
  const parts = header.split(',').reduce<Record<string, string[]>>(
    (acc, part) => {
      const [k, v] = part.split('=');
      if (!k || !v) return acc;
      acc[k] = acc[k] || [];
      acc[k].push(v);
      return acc;
    },
    {},
  );

  const timestamp = parts['t']?.[0];
  const signatures = parts['v1'] || [];
  if (!timestamp || signatures.length === 0) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBuf = await crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(signedPayload),
  );
  const expected = Array.from(new Uint8Array(signatureBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return signatures.some((sig) => timingSafeEqual(sig, expected));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

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

  const rawBody = await req.text();

  if (stripeWebhookSecret) {
    const signatureHeader = req.headers.get('stripe-signature');
    const valid = await verifyStripeSignature(
      rawBody,
      signatureHeader,
      stripeWebhookSecret,
    );
    if (!valid) {
      console.warn('Invalid Stripe webhook signature.');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }

  if (event?.type && event.type !== 'checkout.session.completed') {
    // Other events (e.g. async payment success/failed) — ack and ignore here.
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }

  let session = event?.data?.object;
  if (!session?.id) {
    return new Response(
      JSON.stringify({ error: 'Missing session in event payload.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }

  // If the event payload is a "thin" session (no metadata / no payment_status),
  // retrieve the full session from Stripe.
  if (
    !session.metadata ||
    typeof session.payment_status !== 'string' ||
    typeof session.amount_total !== 'number'
  ) {
    try {
      session = await retrieveStripeSession(session.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Failed to retrieve full Stripe session:', message);
      return new Response(JSON.stringify({ error: message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
  }

  const result = await fulfillCheckoutSession(supabase, session, {
    supabaseUrl,
    serviceRoleKey: supabaseServiceKey,
  });

  if (result.status === 'error') {
    if (result.retryable) {
      // Tell Stripe to retry.
      console.error('Retryable fulfillment error:', result.message);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
    // Non-retryable: ack so Stripe stops retrying, but log loudly.
    console.error(
      'Non-retryable fulfillment error (Stripe will not retry):',
      result.message,
      'session_id:',
      session.id,
    );
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
});
