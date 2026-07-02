// Send a push notification to D14 members via Expo Push.
// Caller must be an authenticated admin (profiles.role = 'admin').
// Body: { title: string, body: string, division?: string }
//   division: optional division name — only devices subscribed to it (or with
//   no division filter) receive the notification.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '');
    if (!jwt) return json(401, { error: 'Missing authorization' });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(jwt);
    if (userError || !user) return json(401, { error: 'Invalid token' });

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (callerProfile?.role !== 'admin') return json(403, { error: 'Admin role required' });

    const { title, body, division } = await req.json();
    if (!title || !body) return json(400, { error: 'title and body are required' });

    let query = admin.from('push_tokens').select('token, divisions');
    const { data: tokens, error: tokenError } = await query;
    if (tokenError) return json(500, { error: tokenError.message });

    const targets = (tokens ?? [])
      .filter((t) => !division || !t.divisions || t.divisions.includes(division))
      .map((t) => t.token);

    if (targets.length === 0) return json(200, { sent: 0, message: 'No registered devices' });

    // Expo Push accepts batches of up to 100 messages
    let sent = 0;
    const errors: unknown[] = [];
    for (let i = 0; i < targets.length; i += 100) {
      const batch = targets.slice(i, i + 100).map((to) => ({
        to,
        title,
        body,
        sound: 'default',
        data: { division: division ?? null },
      }));
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      const result = await res.json();
      if (res.ok) {
        const tickets = result.data ?? [];
        sent += tickets.filter((t: { status: string }) => t.status === 'ok').length;
        // Remove tokens Expo reports as unregistered
        for (let j = 0; j < tickets.length; j++) {
          const ticket = tickets[j];
          if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
            await admin.from('push_tokens').delete().eq('token', batch[j].to);
          }
        }
      } else {
        errors.push(result);
      }
    }

    return json(200, { sent, targeted: targets.length, errors: errors.length ? errors : undefined });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json(500, { error: message });
  }
});
