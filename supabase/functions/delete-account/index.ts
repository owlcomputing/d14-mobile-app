// "Delete my account" from the app (required by Apple once the app can create
// accounts). Caller must be signed in; acts only on the caller's own account.
//
// - Prospects (no membership, no family, no admin/chairman role): the account
//   is deleted immediately. Deleting the auth user cascades to profiles, and
//   from there to push tokens, consents and preferences.
// - Everyone else: membership records, receipts and family accounts hang off
//   the account, so instead of deleting we email a deletion request to the
//   D14 secretary (via the website's `emails` function, which sends to the
//   contact address when no recipient is given).
//
// Response: { result: 'deleted' } or { result: 'requested' }
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

serve(async (req: Request): Promise<Response> => {
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json(401, { error: 'Sign in required' });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(jwt);
    if (userError || !user) return json(401, { error: 'Sign in required' });

    const [{ data: profile }, { count: membershipCount }, { count: childCount }] =
      await Promise.all([
        admin
          .from('profiles')
          .select('first_name, last_name, email, d14_number, role, parent_id, member_type')
          .eq('id', user.id)
          .maybeSingle(),
        admin
          .from('memberships')
          .select('id', { count: 'exact', head: true })
          .eq('profile_id', user.id),
        admin
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('parent_id', user.id),
      ]);

    const isProspect =
      (membershipCount ?? 0) === 0 &&
      (childCount ?? 0) === 0 &&
      !profile?.parent_id &&
      !profile?.member_type &&
      !['admin', 'chairman'].includes(profile?.role ?? '');

    if (isProspect) {
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) throw error;
      return json(200, { result: 'deleted' });
    }

    // Member (or family/officer account): ask D14 staff to handle it.
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || '(no name)';
    const email = profile?.email ?? user.email ?? '(no email)';
    const html = `
      <p>A member asked to delete their account from the AMA District 14 app.</p>
      <ul>
        <li><strong>Name:</strong> ${escapeHtml(name)}</li>
        <li><strong>Email:</strong> ${escapeHtml(email)}</li>
        <li><strong>D14 #:</strong> ${escapeHtml(String(profile?.d14_number ?? '—'))}</li>
        <li><strong>Profile ID:</strong> ${escapeHtml(user.id)}</li>
        <li><strong>Family accounts linked:</strong> ${childCount ?? 0}</li>
      </ul>
      <p>Please confirm with the member, then delete the account (and any family accounts they
      want removed) from the website admin: Admin → Users. Apple expects this to be completed
      promptly.</p>`;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        subject: `App account deletion request: ${name}`,
        html,
        replyTo: user.email ?? undefined,
      }),
    });
    if (!res.ok) throw new Error(`Could not send the request (${res.status})`);
    return json(200, { result: 'requested' });
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : 'Server error' });
  }
});
