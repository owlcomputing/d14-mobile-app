import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  'SUPABASE_SERVICE_ROLE_KEY'
)!;
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;

serve(
  async (req: Request): Promise<Response> => {
    console.log('Request received:', req);

    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    let requestData;
    try {
      requestData = await req.json();
    } catch (error) {
      console.error('Failed to parse request body:', error);
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const {
      priceId,
      recurring,
      user_id,
      renewal,
      postSignupFamilyMember,
      familyOnly,
      returnUrl,
    } = requestData;
    let familySize = 1;

    console.log('Request data:', requestData);

    try {
      // Fetch child count if user_id is provided and no renewal or postSignupFamilyMember
      if (user_id && !renewal && !postSignupFamilyMember) {
        const childCountRes = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?parent_id=eq.${user_id}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              apikey: SUPABASE_SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SUPABASE_SUPABASE_SERVICE_ROLE_KEY}`,
            },
          }
        );

        if (!childCountRes.ok) {
          const errorDetail = await childCountRes.json();
          throw new Error(
            `Error fetching child count: ${JSON.stringify(errorDetail)}`
          );
        }

        const childCount = (await childCountRes.json()).length;
        familySize = familyOnly && childCount > 0 ? childCount : childCount + 1;
      }

      // Handle renewal count
      else if (user_id && renewal) {
        const renewalCountRes = await fetch(
          `${SUPABASE_URL}/rest/v1/renewals?or=(id.eq.${user_id},parent_id.eq.${user_id})`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              apikey: SUPABASE_SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SUPABASE_SUPABASE_SERVICE_ROLE_KEY}`,
            },
          }
        );

        if (!renewalCountRes.ok) {
          const errorDetail = await renewalCountRes.json();
          throw new Error(
            `Error fetching renewal count: ${JSON.stringify(errorDetail)}`
          );
        }

        familySize = (await renewalCountRes.json()).length;
      }

      // Handle postSignupFamilyMember case, this also handles if the parent is becoming a full member
      else if (user_id && postSignupFamilyMember) {
        let childCountRes = await fetch(
          `${SUPABASE_URL}/rest/v1/temp_membership_form_data?parent_id=eq.${user_id}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              apikey: SUPABASE_SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SUPABASE_SUPABASE_SERVICE_ROLE_KEY}`,
            },
          }
        );

        if (!childCountRes.ok) {
          const errorDetail = await childCountRes.json();
          throw new Error(
            `Error fetching temp child count: ${JSON.stringify(errorDetail)}`
          );
        }

        let tempChildCount = (await childCountRes.json()).length;

        // If no matches, check if the parent member is in temp
        if (tempChildCount === 0) {
          childCountRes = await fetch(
            `${SUPABASE_URL}/rest/v1/temp_membership_form_data?user_id=eq.${user_id}`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                apikey: SUPABASE_SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SUPABASE_SUPABASE_SERVICE_ROLE_KEY}`,
              },
            }
          );

          if (!childCountRes.ok) {
            const errorDetail = await childCountRes.json();
            throw new Error(
              `Error fetching temp parent count: ${JSON.stringify(errorDetail)}`
            );
          }

          tempChildCount = (await childCountRes.json()).length;
        }

        familySize = tempChildCount;
      }

      // Create parameters for Stripe Checkout
      const params = new URLSearchParams();
      params.append('ui_mode', 'embedded');
      params.append('payment_method_types[]', 'card');
      params.append('line_items[0][price]', priceId);
      params.append('line_items[0][quantity]', familySize.toString());
      params.append('mode', recurring ? 'subscription' : 'payment');
      params.append('return_url', returnUrl);
      params.append('metadata[user_id]', user_id);

      console.log('Stripe request params:', params.toString());

      // Send request to Stripe
      const stripeResponse = await fetch(
        'https://api.stripe.com/v1/checkout/sessions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stripeSecretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        }
      );

      const session = await stripeResponse.json();
      if (!stripeResponse.ok) {
        throw new Error(
          `Error creating Stripe session: ${JSON.stringify(session)}`
        );
      }

      console.log('Stripe session created:', session);
      return new Response(JSON.stringify({ id: session.client_secret }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } catch (error) {
      console.error('Error creating Stripe session:', error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
  },
  { isPublic: true }
);
