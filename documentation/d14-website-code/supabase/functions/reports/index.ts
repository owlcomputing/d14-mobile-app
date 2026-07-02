import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SUPABASE_SERVICE_ROLE_KEY');

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey',
};

console.log("STRIPE_SECRET_KEY", stripeSecretKey);

if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY environment variable is not set.");
}

serve(async (req: Request): Promise<Response> => {
  console.log("Request received:", req);

  // Handle preflight requests (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let startDate;
  let endDate;

  try {
    if (req.method === 'POST') {
      // Extract body from the POST request
      const body = await req.json();
      startDate = body.startDate;
      endDate = body.endDate;
    } else if (req.method === 'GET') {
      const url = new URL(req.url);
      startDate = url.searchParams.get("startDate");
      endDate = url.searchParams.get("endDate");
    }

    console.log("Received dates:", { startDate, endDate });

    // Define parameters for the Stripe Balance Transactions API
    const params = new URLSearchParams();
    if (startDate) {
      params.append("created[gte]", startDate); // Filter transactions by start date
    }
    if (endDate) {
      params.append("created[lte]", endDate); // Filter transactions by end date
    }

    console.log("Fetching transactions from Stripe...");

    // Fetch transactions from Stripe using the Balance Transactions API
    const response = await fetch("https://api.stripe.com/v1/balance_transactions", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const transactions = await response.json();

    console.log("Stripe transactions:", transactions);

    // Return the fetched transactions
    return new Response(JSON.stringify(transactions), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error("Error fetching Stripe transactions:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
}, { isPublic: true });
