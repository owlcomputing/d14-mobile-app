// Shared by send-push (admin sends) and event-notifications (daily job):
// who receives a notification, sending through Expo Push and SendGrid, the
// email template, unsubscribe links, and the send history.
//
// Email safety: NOTIFY_EMAIL_MODE controls whether email copies go out.
//   off (default)  never send email
//   allowlist      only to addresses in NOTIFY_EMAIL_ALLOWLIST (comma-separated);
//                  use on staging, whose database is a copy of real member data
//   live           send to everyone in the audience
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY') ?? '';
const UNSUBSCRIBE_SECRET = Deno.env.get('UNSUBSCRIBE_SECRET') ?? SERVICE_ROLE_KEY;
export const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://ama-d14.org').replace(/\/$/, '');
const MAILING_ADDRESS =
  Deno.env.get('D14_MAILING_ADDRESS') ??
  'AMA District 14 · 13785 Spring Creek Rd SW · Fife Lake, MI 49633';
const FROM_EMAIL = 'no-reply@em5910.ama-d14.org';
const REPLY_TO = Deno.env.get('CONTACT_EMAIL') ?? 'secretary@ama-d14.org';

export type Admin = SupabaseClient;
export const adminClient = (): Admin => createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

export type Audience = 'everyone' | 'members' | 'prospects';
export const AUDIENCES: Audience[] = ['everyone', 'members', 'prospects'];

export type PushTarget = { token: string; profile_id: string; divisions: string[] | null };
export type EmailTarget = {
  profile_id: string;
  email: string;
  first_name: string | null;
  is_member: boolean;
  /** effective division interests; null = all */
  divisions: string[] | null;
};

// ---------------------------------------------------------------------------
// Audience
// ---------------------------------------------------------------------------

/** Run a set-returning RPC past PostgREST's 1,000-row page limit. */
async function rpcAll<T>(admin: Admin, fn: string, args: Record<string, unknown>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.rpc(fn, args).range(from, from + 999);
    if (error) throw new Error(`${fn}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

export const getPushTargets = (admin: Admin, audience: Audience, divisions: string[] | null) =>
  rpcAll<PushTarget>(admin, 'notification_push_targets', {
    p_audience: audience,
    p_divisions: divisions,
  });

export const getEmailTargets = (admin: Admin, audience: Audience, divisions: string[] | null) =>
  rpcAll<EmailTarget>(admin, 'notification_email_targets', {
    p_audience: audience,
    p_divisions: divisions,
  });

/** Does someone following `interests` (null = all) care about `division` (null = district-wide)? */
export const follows = (interests: string[] | null, division: string | null) =>
  !division || !interests || interests.includes(division);

// ---------------------------------------------------------------------------
// Links: the app opens in-app paths; emails link to the matching website page
// ---------------------------------------------------------------------------

const IN_APP_LINK = /^\/(event|division)\/\d+$|^\/(renew|calendar)$/;

/** null = no link; undefined = invalid */
export function parseLink(link: unknown): string | null | undefined {
  if (link === null || link === undefined || link === '') return null;
  if (typeof link !== 'string' || link.length > 500) return undefined;
  if (IN_APP_LINK.test(link)) return link;
  try {
    const url = new URL(link);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function webUrl(link: string): string {
  if (link.startsWith('https://')) return link;
  let m: RegExpExecArray | null;
  if ((m = /^\/event\/(\d+)$/.exec(link))) return `${SITE_URL}/secure/event/${m[1]}`;
  if ((m = /^\/division\/(\d+)$/.exec(link))) return `${SITE_URL}/secure/divisions/${m[1]}`;
  if (link === '/renew') return `${SITE_URL}/secure/membership`;
  if (link === '/calendar') return `${SITE_URL}/secure/calendar`;
  return SITE_URL;
}

// ---------------------------------------------------------------------------
// Push (Expo)
// ---------------------------------------------------------------------------

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export async function sendPush(
  admin: Admin,
  messages: PushMessage[],
): Promise<{ sent: number; errors: string[] }> {
  let sent = 0;
  const errors: string[] = [];
  // Expo accepts up to 100 messages per request
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages
      .slice(i, i + 100)
      .map((m) => ({ sound: 'default', channelId: 'default', ...m }));
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        errors.push(`Expo push failed (${res.status})`);
        continue;
      }
      const tickets: { status: string; message?: string; details?: { error?: string } }[] =
        result.data ?? [];
      const dead: string[] = [];
      tickets.forEach((t, j) => {
        if (t.status === 'ok') sent++;
        else if (t.details?.error === 'DeviceNotRegistered') dead.push(batch[j].to);
        else errors.push(t.details?.error ?? t.message ?? 'Push error');
      });
      // The app was uninstalled or the token expired
      if (dead.length) await admin.from('push_tokens').delete().in('token', dead);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { sent, errors: [...new Set(errors)] };
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

/** Apply NOTIFY_EMAIL_MODE. `note` explains anything skipped (stored in the send history). */
export function applyEmailMode(targets: EmailTarget[]): {
  targets: EmailTarget[];
  note: string | null;
} {
  const mode = (Deno.env.get('NOTIFY_EMAIL_MODE') ?? 'off').trim().toLowerCase();
  if (mode === 'live') {
    return SENDGRID_API_KEY ? { targets, note: null } : { targets: [], note: 'SendGrid key missing' };
  }
  if (mode === 'allowlist') {
    const allow = new Set(
      (Deno.env.get('NOTIFY_EMAIL_ALLOWLIST') ?? '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
    const kept = targets.filter((t) => allow.has(t.email));
    return {
      targets: kept,
      note: `Test mode: sent only to allow-listed addresses (${kept.length} of ${targets.length} recipients)`,
    };
  }
  return {
    targets: [],
    note: `Email sending is turned off (${targets.length} recipients would have been emailed)`,
  };
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function base64url(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(UNSUBSCRIBE_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`unsubscribe:${value}`));
  return base64url(sig).slice(0, 32);
}

/**
 * The email footer's unsubscribe link: a confirmation page on the website
 * (Supabase serves function GET responses as plain text, so the function
 * can't host the page itself). Its button posts to email-unsubscribe.
 */
export async function unsubscribeUrl(profileId: string) {
  return `${SITE_URL}/unsubscribe?p=${profileId}&s=${await sign(profileId)}`;
}

/** The List-Unsubscribe target: mail apps' one-click unsubscribe POSTs here directly. */
export async function unsubscribePostUrl(profileId: string) {
  return `${SUPABASE_URL}/functions/v1/email-unsubscribe?p=${profileId}&s=${await sign(profileId)}`;
}

export async function verifyUnsubscribe(profileId: string, signature: string) {
  const expected = await sign(profileId);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

export type EmailItem = {
  title?: string;
  /** small line under the title, e.g. "Enduro · Saturday, May 3 · Lost Lake" */
  meta?: string;
  /** paragraph text; blank lines start new paragraphs */
  text?: string;
  url?: string;
  cta?: string;
};
export type EmailSection = { heading?: string; items: EmailItem[] };

// Per-recipient values filled in by SendGrid (personalizations[].substitutions)
const UNSUB_TAG = '%unsubscribe_url%';
const REASON_TAG = '%reason%';

/** Branded email (light background for mail clients) with a plain-text twin. */
export function renderEmail(opts: { heading: string; intro?: string; sections: EmailSection[] }) {
  const paragraphs = (text: string) =>
    text
      .split(/\n\s*\n/)
      .map(
        (p) =>
          `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#222">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`,
      )
      .join('');

  const itemHtml = (it: EmailItem) => `
    <tr><td style="padding:12px 0;border-bottom:1px solid #eee">
      ${
        it.title
          ? `<div style="font-size:16px;font-weight:700;color:#111">${
              it.url
                ? `<a href="${escapeHtml(it.url)}" style="color:#111;text-decoration:none">${escapeHtml(it.title)}</a>`
                : escapeHtml(it.title)
            }</div>`
          : ''
      }
      ${it.meta ? `<div style="font-size:13px;color:#666;margin-top:3px">${escapeHtml(it.meta)}</div>` : ''}
      ${it.text ? `<div style="margin-top:10px">${paragraphs(it.text)}</div>` : ''}
      ${
        it.url && it.cta
          ? `<a href="${escapeHtml(it.url)}" style="display:inline-block;margin-top:4px;background:#E63946;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:10px 18px;border-radius:8px">${escapeHtml(it.cta)}</a>`
          : ''
      }
    </td></tr>`;

  const sectionsHtml = opts.sections
    .map(
      (s) => `
      ${s.heading ? `<h2 style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#E63946;margin:24px 0 4px">${escapeHtml(s.heading)}</h2>` : ''}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${s.items.map(itemHtml).join('')}</table>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden">
  <tr><td style="background:#0A0A0A;padding:16px 24px;color:#fff;font-weight:800;font-size:15px;letter-spacing:1px">AMA DISTRICT 14</td></tr>
  <tr><td style="padding:24px">
    <h1 style="font-size:22px;line-height:1.3;margin:0 0 12px;color:#111">${escapeHtml(opts.heading)}</h1>
    ${opts.intro ? paragraphs(opts.intro) : ''}
    ${sectionsHtml}
  </td></tr>
  <tr><td style="padding:16px 24px 24px;font-size:12px;line-height:1.6;color:#777;border-top:1px solid #eee">
    You're getting this email because ${REASON_TAG}.
    <a href="${UNSUB_TAG}" style="color:#777">Unsubscribe</a> from these emails, or change them in the D14 app under Profile &rsaquo; Communications.<br>
    ${escapeHtml(MAILING_ADDRESS)}
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  const textItems = (it: EmailItem) =>
    [it.title, it.meta, it.text, it.url].filter(Boolean).join('\n');
  const text = [
    'AMA DISTRICT 14',
    '',
    opts.heading,
    opts.intro ?? '',
    ...opts.sections.map((s) =>
      [s.heading ? `\n${s.heading.toUpperCase()}` : '', ...s.items.map(textItems)].join('\n\n'),
    ),
    '',
    '--',
    `You're getting this email because ${REASON_TAG}.`,
    `Unsubscribe: ${UNSUB_TAG}`,
    MAILING_ADDRESS,
  ].join('\n');

  return { html, text };
}

/** Send one email (same content) to each recipient individually, with their own unsubscribe link. */
export async function sendEmail(
  recipients: EmailTarget[],
  subject: string,
  content: { html: string; text: string },
): Promise<{ sent: number; errors: string[] }> {
  let sent = 0;
  const errors: string[] = [];
  // SendGrid allows up to 1,000 personalizations per request
  for (let i = 0; i < recipients.length; i += 1000) {
    const chunk = recipients.slice(i, i + 1000);
    const personalizations = await Promise.all(
      chunk.map(async (r) => {
        return {
          to: [{ email: r.email }],
          substitutions: {
            [UNSUB_TAG]: await unsubscribeUrl(r.profile_id),
            [REASON_TAG]: r.is_member
              ? "you're an AMA District 14 member"
              : 'you asked for AMA District 14 news and event emails',
          },
          headers: {
            'List-Unsubscribe': `<${await unsubscribePostUrl(r.profile_id)}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        };
      }),
    );
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations,
          from: { email: FROM_EMAIL, name: 'AMA District 14' },
          reply_to: { email: REPLY_TO },
          subject,
          content: [
            { type: 'text/plain', value: content.text },
            { type: 'text/html', value: content.html },
          ],
          // Keep links (including unsubscribe) as written
          tracking_settings: { click_tracking: { enable: false, enable_text: false } },
        }),
      });
      if (res.ok) sent += chunk.length;
      else errors.push(`SendGrid ${res.status}: ${(await res.text()).slice(0, 300)}`);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { sent, errors };
}

// ---------------------------------------------------------------------------
// Send history
// ---------------------------------------------------------------------------

export type SendRecord = {
  kind: 'manual' | 'event_auto';
  sent_by?: string | null;
  title: string;
  body: string;
  link?: string | null;
  audience: Audience;
  divisions?: string[] | null;
  push_targeted?: number;
  push_sent?: number;
  email_requested?: boolean;
  email_sent?: number;
  email_note?: string | null;
  error?: string | null;
};

export async function logSend(admin: Admin, record: SendRecord): Promise<number | null> {
  const { data, error } = await admin.from('notification_sends').insert(record).select('id').single();
  if (error) console.error('notification_sends insert failed', error.message);
  return data?.id ?? null;
}

export async function updateSend(admin: Admin, id: number | null, patch: Partial<SendRecord>) {
  if (id === null) return;
  const { error } = await admin.from('notification_sends').update(patch).eq('id', id);
  if (error) console.error('notification_sends update failed', error.message);
}
