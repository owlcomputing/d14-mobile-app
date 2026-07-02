import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Initialize Supabase client
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// CORS headers
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle CORS preflight request
const handleOptions = () => new Response(null, { status: 204, headers });

// Define the type for the update options
interface UpdateOptions {
  [key: string]: string | number | boolean | null | undefined;
}

// Function to handle the updateUser process
const handleUpdateUser = async (
  userID: string,
  updateOptions: UpdateOptions,
  newExpiration: Date | null
) => {
  let children = [];

  if (updateOptions.email) {
    // checking if this is a profile being assigned to a parent (or is assigned already)
    if (updateOptions.parent_id) {
      // better child email creation to check emails of existing children
      const { data: childProfiles, error: childError } = await supabase
        .from('profiles')
        .select('email')
        .eq('parent_id', updateOptions.parent_id);

      if (childError) {
        return new Response(
          JSON.stringify({
            error: `Failed to fetch child profiles: ${childError.message}`,
          }),
          { status: 500, headers }
        );
      }

      // loop through the child profiles emails to find the lowest available +child<i> email
      let childEmail = '';
      for (let i = 0; i < childProfiles.length + 1; i++) {
        const baseEmail = (updateOptions.email as string)
          .split('@')[0]
          .split('+')[0];
        childEmail = `${baseEmail}+child${i}@${
          (updateOptions.email as string).split('@')[1]
        }`;
        if (!childProfiles.some((child) => child.email === childEmail)) break;
      }
      updateOptions.email = childEmail;
      console.log('Generated child email:', childEmail);
    }
    await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay
    const { data: authData, error: authError } =
      await supabase.auth.admin.updateUserById(userID, {
        email: updateOptions.email as string,
      });

    if (authError) {
      console.error('Auth update error details:', {
        userID,
        attemptedEmail: updateOptions.email,
        message: authError.message,
        status: authError.status,
        code: authError.code,
      });
      return new Response(
        JSON.stringify({
          error: `Failed to update auth email: ${authError.message}`,
          details: authError,
        }),
        { status: 500, headers }
      );
    }

    const { data: childProfiles, error: childError } = await supabase
      .from('profiles')
      .select('*')
      .eq('parent_id', userID);

    if (childError) {
      return new Response(
        JSON.stringify({
          error: `Failed to fetch child profiles: ${childError.message}`,
        }),
        { status: 500, headers }
      );
    }

    children = childProfiles;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updateOptions)
    .eq('id', userID);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers,
    });
  }

  const childUpdateOptions: UpdateOptions = { ...updateOptions };
  const fieldsToDelete = [
    'first_name',
    'last_name',
    'birthdate',
    'disciplines',
    'member_type',
  ];
  fieldsToDelete.forEach((field) => delete childUpdateOptions[field]);
  childUpdateOptions.emergency_contact_name = `${updateOptions.first_name} ${updateOptions.last_name}`;
  childUpdateOptions.emergency_contact_phone =
    updateOptions.cell_phone || updateOptions.home_phone || null;

  const childUpdates = children.map((child, index) => {
    const emailParts = (updateOptions.email as string).split('@');
    return supabase
      .from('profiles')
      .update({
        ...childUpdateOptions,
        email: `${emailParts[0]}+child${index}@${emailParts[1]}`,
      })
      .eq('id', child.id);
  });

  await Promise.all(childUpdates);

  if (newExpiration !== null) {
    const { error: expirationError } = await supabase
      .from('memberships')
      .update({ expiration: newExpiration, last_modified: new Date() })
      .eq('profile_id', userID);

    if (expirationError) {
      return new Response(
        JSON.stringify({
          error: `Failed to update expiration: ${expirationError.message}`,
        }),
        { status: 500, headers }
      );
    }
  }

  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers,
  });
};

// Main server handler
serve(
  async (req) => {
    try {
      if (req.method === 'OPTIONS') return handleOptions();
      if (req.method !== 'POST') {
        return new Response(
          JSON.stringify({ error: 'Invalid request method' }),
          { status: 405, headers }
        );
      }

      const body = await req.json().catch(() => null);
      if (
        !body ||
        typeof body.userID !== 'string' ||
        typeof body.updateOptions !== 'object'
      ) {
        return new Response(JSON.stringify({ error: 'Invalid request body' }), {
          status: 400,
          headers,
        });
      }

      const { userID, updateOptions, newExpiration } = body;
      if (newExpiration !== null) {
        return await handleUpdateUser(
          userID,
          updateOptions,
          new Date(newExpiration)
        );
      } else {
        return await handleUpdateUser(userID, updateOptions, null);
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Server error' }), {
        status: 500,
        headers,
      });
    }
  },
  {
    isPublic: true,
  }
);
