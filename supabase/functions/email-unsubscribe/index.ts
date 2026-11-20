// Unsubscribe link in notification emails (no sign-in; the link is signed).
//
//   GET  ?p=<profile id>&s=<signature>  confirmation page with an Unsubscribe
//        button. Opening the link alone changes nothing, because mail
//        scanners open links automatically.
//   POST same query  unsubscribe. Used by the button and by mail apps'
//        one-click unsubscribe (List-Unsubscribe-Post, RFC 8058).
//
// Unsubscribing adds an email_marketing = off row to communication_consents,
// the same as turning off "Email news & offers" in the app. Push is unaffected.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

import { adminClient, verifyUnsubscribe } from '../_shared/notify.ts';

const EMAIL_CONSENT_TEXT =
  'Email me AMA District 14 news, event reminders and membership offers. I can unsubscribe at any time.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page(status: number, heading: string, message: string, form?: string) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>AMA District 14</title>
  <style>
    body { font-family: -apple-system, Roboto, sans-serif; background: #0A0A0A; color: #fff;
           display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .box { text-align: center; padding: 24px; max-width: 360px; }
    .brand { font-weight: 800; letter-spacing: 1px; font-size: 13px; color: #E63946; margin-bottom: 16px; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    p { color: #A5A9B0; font-size: 14px; line-height: 1.5; margin: 0 0 24px; }
    button { width: 100%; background: #E63946; color: #fff; border: 0; font-weight: 700;
             font-size: 16px; padding: 16px 24px; border-radius: 12px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="box">
    <div class="brand">AMA DISTRICT 14</div>
    <h1>${escapeHtml(heading)}</h1>
    <p>${escapeHtml(message)}</p>
    ${form ?? ''}
  </div>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const profileId = url.searchParams.get('p') ?? '';
  const signature = url.searchParams.get('s') ?? '';

  if (!UUID.test(profileId) || !(await verifyUnsubscribe(profileId, signature))) {
    return page(
      400,
      'Link not valid',
      'This unsubscribe link is incomplete or has expired. You can turn off emails in the D14 app under Profile › Communications, or reply to any D14 email.',
    );
  }

  if (req.method === 'GET') {
    return page(
      200,
      'Unsubscribe from D14 emails?',
      "You'll stop getting AMA District 14 news and event emails. Push notifications in the app aren't affected.",
      `<form method="POST" action="?p=${encodeURIComponent(profileId)}&s=${encodeURIComponent(signature)}">
        <button type="submit">Unsubscribe</button>
      </form>`,
    );
  }

  if (req.method !== 'POST') return page(405, 'Not supported', 'Please use the link in the email.');

  try {
    const admin = adminClient();
    const { data: current } = await admin
      .from('current_communication_consents')
      .select('granted')
      .eq('profile_id', profileId)
      .eq('channel', 'email_marketing')
      .maybeSingle();
    if (current?.granted !== false) {
      const { error } = await admin.from('communication_consents').insert({
        profile_id: profileId,
        channel: 'email_marketing',
        granted: false,
        source: 'email:unsubscribe-link',
        consent_text: EMAIL_CONSENT_TEXT,
      });
      // A deleted account has nothing to unsubscribe
      if (error && !/foreign key/i.test(error.message)) throw new Error(error.message);
    }
    return page(
      200,
      "You're unsubscribed",
      'You won’t get AMA District 14 news and event emails anymore. To turn them back on, use Profile › Communications in the D14 app.',
    );
  } catch (e) {
    console.error('unsubscribe failed', e instanceof Error ? e.message : e);
    return page(500, 'Something went wrong', 'Please try again in a minute.');
  }
});
