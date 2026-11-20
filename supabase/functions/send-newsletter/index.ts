// Website email newsletter (Admin › Notifications › Email newsletter).
// Caller must be a signed-in admin (profiles.role = 'admin').
//
// Body: {
//   subject: string,               // up to 200 characters
//   html: string,                  // the newsletter body from the editor (admin-written HTML)
//   divisions?: string[],          // everyone whose profile lists one of these disciplines
//   to?: string[],                 // addresses picked by hand (members by name, charter clubs)
//   test?: boolean,                // send only to the calling admin
// }
//
// Division recipients who unsubscribed (latest email_marketing consent off)
// are skipped, and the rest get their own unsubscribe link. Addresses picked
// by hand always get the email, without an unsubscribe link. Each address
// gets one copy; family members' "+child" addresses go to the parent's inbox.
//
// NEWSLETTER_EMAIL_MODE: live (default) / allowlist (NOTIFY_EMAIL_ALLOWLIST
// only; use on staging, whose database is a copy of real member data) / off.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

import {
  adminClient,
  applyEmailMode,
  renderNewsletter,
  sendNewsletter,
  unsubscribeUrl,
  type NewsletterRecipient,
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

const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

const strings = (v: unknown) =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean)
    : [];

/**
 * parent+child2@example.com → parent@example.com: family members' profiles use
 * the parent's address with a +childN tag and share the parent's inbox. Other
 * + addresses are real and are kept as they are.
 */
const inbox = (email: string) => email.replace(/\+child\d*@/i, '@').toLowerCase();

type Row = {
  email: string;
  holder_id: string | null;
  is_member: boolean;
  opted_out: boolean;
  by_division: boolean;
};

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

    const { data: caller } = await admin
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .single();
    if (caller?.role !== 'admin') return json(403, { error: 'Admin role required' });

    const input = await req.json().catch(() => null);
    if (!input || typeof input !== 'object') return json(400, { error: 'Invalid JSON body' });

    const subject = typeof input.subject === 'string' ? input.subject.replace(/[\r\n]+/g, ' ').trim() : '';
    const html = typeof input.html === 'string' ? input.html.trim() : '';
    if (!subject || !html) return json(400, { error: 'Subject and content are required' });
    if (subject.length > 200) return json(400, { error: 'Subject is too long (200 characters max)' });
    if (html.length > 2_000_000) {
      return json(400, { error: 'The email is too large. Use smaller or fewer pictures.' });
    }

    const test = input.test === true;
    const divisions = strings(input.divisions);
    const picked = strings(input.to).filter((e) => EMAIL_RE.test(e));

    // --- Recipients -----------------------------------------------------------
    let recipients: NewsletterRecipient[];
    let skippedUnsubscribed = 0;
    if (test) {
      const email = caller.email?.trim().toLowerCase();
      if (!email) return json(400, { error: 'Your account has no email address' });
      recipients = [{ email, unsubscribeProfileId: user.id, is_member: true }];
    } else {
      if (!divisions.length && !picked.length) {
        return json(400, { error: 'Choose at least one division or recipient' });
      }
      const rows: Row[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await admin
          .rpc('newsletter_recipients', {
            p_divisions: divisions.length ? divisions : null,
            p_emails: picked.length ? picked : null,
          })
          .range(from, from + 999);
        if (error) throw new Error(`newsletter_recipients: ${error.message}`);
        rows.push(...((data ?? []) as Row[]));
        if (!data || data.length < 1000) break;
      }

      // One copy per inbox. Picked by hand wins: always sent, no unsubscribe link.
      const byInbox = new Map<string, Row & { picked: boolean }>();
      for (const r of rows) {
        if (!EMAIL_RE.test(r.email)) continue;
        const key = inbox(r.email);
        const seen = byInbox.get(key);
        if (!seen) byInbox.set(key, { ...r, picked: !r.by_division });
        else {
          seen.picked ||= !r.by_division;
          // Opted out if any profile behind this inbox opted out
          seen.opted_out ||= r.opted_out;
          seen.is_member ||= r.is_member;
          seen.holder_id ??= r.holder_id;
        }
      }
      recipients = [];
      for (const [address, r] of byInbox) {
        if (r.picked) {
          recipients.push({ email: address, unsubscribeProfileId: null, is_member: r.is_member });
        } else if (r.opted_out) {
          skippedUnsubscribed++;
        } else {
          recipients.push({ email: address, unsubscribeProfileId: r.holder_id, is_member: r.is_member });
        }
      }
    }

    const total = recipients.length;
    const { targets, note } = test
      ? { targets: recipients, note: null }
      : applyEmailMode(recipients, 'NEWSLETTER_EMAIL_MODE', 'live');

    console.log('send-newsletter', {
      test,
      divisions: divisions.length,
      picked: picked.length,
      recipients: total,
      sending: targets.length,
      skippedUnsubscribed,
    });

    const result = targets.length
      ? await sendNewsletter(targets, test ? `[Test] ${subject}` : subject, renderNewsletter(html))
      : { sent: 0, errors: [] };

    return json(200, {
      test,
      recipients: total,
      sent: result.sent,
      skippedUnsubscribed,
      note,
      ...(test ? { unsubscribeUrl: await unsubscribeUrl(user.id) } : {}),
      errors: result.errors.length ? result.errors : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('send-newsletter failed', message);
    return json(500, { error: message });
  }
});
