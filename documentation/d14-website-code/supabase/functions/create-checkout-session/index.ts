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
      customerEmail,
    } = requestData;
    let familySize = 1;
    let renewalProfileIds: string[] = [];

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

        const renewalSelections = await renewalCountRes.json();
        familySize = renewalSelections.length;
        renewalProfileIds = renewalSelections.map(
          (selection: { id: string }) => selection.id
        );

        if (familySize === 0) {
          return new Response(
            JSON.stringify({ error: 'No renewal records found. Cannot create a checkout session with zero items.' }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            }
          );
        }
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
      if (typeof customerEmail === 'string' && customerEmail.trim()) {
        params.append('customer_email', customerEmail.trim());
      }
      if (renewal) {
        params.append('metadata[checkout_type]', 'renewal');
        params.append('metadata[renewal_count]', familySize.toString());
        params.append(
          'metadata[renewal_profile_ids]',
          renewalProfileIds.join(',')
        );
      } else if (postSignupFamilyMember) {
        params.append('metadata[checkout_type]', 'post_signup_membership');
      } else {
        params.append('metadata[checkout_type]', 'new_membership');
      }

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
      const message = error instanceof Error ? error.message : String(error);
      console.error('Error creating Stripe session:', message);
      return new Response(JSON.stringify({ error: message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
  }
);
