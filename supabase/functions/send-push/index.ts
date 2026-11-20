// Admin push notification, optionally with an email copy.
// Caller must be a signed-in admin (profiles.role = 'admin').
//
// Body: {
//   title: string,                 // up to 100 characters
//   body: string,                  // up to 1,000 characters
//   audience?: 'everyone' | 'members' | 'prospects'   (default everyone)
//   divisions?: string[] | null,   // division names; empty/null = district-wide
//   division?: string,             // older app builds: a single division
//   link?: string,                 // '/event/12', '/division/3', '/renew', '/calendar' or an https URL
//   email?: boolean,               // also email the audience (see _shared/notify.ts)
//   test?: boolean,                // send only to the calling admin's own devices/email
// }
// Every send except a test is recorded in notification_sends.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

import {
  adminClient,
  applyEmailMode,
  AUDIENCES,
  getEmailTargets,
  getPushTargets,
  logSend,
  parseLink,
  renderEmail,
  sendEmail,
  sendPush,
  unsubscribeUrl,
  updateSend,
  webUrl,
  type Admin,
  type Audience,
  type EmailTarget,
} from '../_shared/notify.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function ctaLabel(link: string) {
  if (link.startsWith('/event/')) return 'View event';
  if (link.startsWith('/division/')) return 'View division';
  if (link === '/renew') return 'Renew membership';
  if (link === '/calendar') return 'See the calendar';
  return 'Learn more';
}

/** The calling admin as the only email recipient (test sends). */
async function ownEmail(admin: Admin, userId: string): Promise<EmailTarget[]> {
  const { data } = await admin.from('profiles').select('email, first_name').eq('id', userId).single();
  const email = data?.email?.trim().toLowerCase();
  return email
    ? [{ profile_id: userId, email, first_name: data?.first_name ?? null, is_member: true, divisions: null }]
    : [];
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json(401, { error: 'Missing authorization' });

    const admin = adminClient();
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

    const input = await req.json().catch(() => null);
    if (!input || typeof input !== 'object') return json(400, { error: 'Invalid JSON body' });

    const title = str(input.title);
    const body = str(input.body);
    if (!title || !body) return json(400, { error: 'Title and message are required' });
    if (title.length > 100) return json(400, { error: 'Title is too long (100 characters max)' });
    if (body.length > 1000) return json(400, { error: 'Message is too long (1,000 characters max)' });

    const audience = (input.audience ?? 'everyone') as Audience;
    if (!AUDIENCES.includes(audience)) return json(400, { error: 'Unknown audience' });

    let divisions: string[] | null = Array.isArray(input.divisions)
      ? input.divisions.filter((d: unknown): d is string => typeof d === 'string' && !!d.trim())
      : str(input.division)
        ? [str(input.division)]
        : null;
    if (divisions && divisions.length === 0) divisions = null;

    const link = parseLink(input.link);
    if (link === undefined) {
      return json(400, { error: 'Link must be an https:// web address or an app screen' });
    }
    const wantEmail = input.email === true;
    const test = input.test === true;

    // --- Push -----------------------------------------------------------------
    const pushTargets = test
      ? (
          await admin.from('push_tokens').select('token, profile_id, divisions').eq('profile_id', user.id)
        ).data ?? []
      : await getPushTargets(admin, audience, divisions);
    const sendId = test ? null : await logSend(admin, {
      kind: 'manual',
      sent_by: user.id,
      title,
      body,
      link,
      audience,
      divisions,
      push_targeted: pushTargets.length,
      email_requested: wantEmail,
    });

    const push = await sendPush(
      admin,
      pushTargets.map((t) => ({
        to: t.token,
        title,
        body,
        data: { url: link, sendId },
      })),
    );

    // --- Email copy -----------------------------------------------------------
    let emailTargeted = 0;
    let emailSent = 0;
    let emailNote: string | null = null;
    const errors = [...push.errors];
    if (wantEmail) {
      const all = test ? await ownEmail(admin, user.id) : await getEmailTargets(admin, audience, divisions);
      emailTargeted = all.length;
      const { targets, note } = applyEmailMode(all);
      emailNote = note;
      if (targets.length) {
        const url = link ? webUrl(link) : undefined;
        const content = renderEmail({
          heading: title,
          sections: [
            {
              items: [
                {
                  meta: divisions ? divisions.join(' · ') : undefined,
                  text: body,
                  url,
                  cta: link ? ctaLabel(link) : undefined,
                },
              ],
            },
          ],
        });
        const email = await sendEmail(targets, test ? `[Test] ${title}` : title, content);
        emailSent = email.sent;
        errors.push(...email.errors);
      }
    }

    await updateSend(admin, sendId, {
      push_sent: push.sent,
      email_sent: emailSent,
      email_note: emailNote,
      error: errors.length ? errors.join('; ').slice(0, 1000) : null,
    });

    return json(200, {
      id: sendId,
      test,
      // A test send returns the admin's own unsubscribe link, to try the page
      ...(test ? { unsubscribeUrl: await unsubscribeUrl(user.id) } : {}),
      sent: push.sent,
      targeted: pushTargets.length,
      emailTargeted,
      emailed: emailSent,
      emailNote,
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('send-push failed', message);
    return json(500, { error: message });
  }
});
