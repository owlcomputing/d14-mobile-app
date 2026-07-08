// Daily job: push renewal reminders to members whose memberships expire in
// 30 days or 7 days. Invoked by pg_cron with an x-cron-secret header.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET')!;

const REMINDER_DAYS = [30, 7];

serve(async (req: Request): Promise<Response> => {
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return json(401, { error: 'Unauthorized' });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const today = new Date();
  const messages: { to: string; title: string; body: string; sound: string }[] = [];
  const summary: Record<string, number> = {};

  for (const days of REMINDER_DAYS) {
    const target = new Date(today);
    target.setUTCDate(target.getUTCDate() + days);
    const targetDate = target.toISOString().slice(0, 10);

    // Memberships expiring on the target date, with the member's parent (for
    // family members whose devices belong to the parent)
    const { data: expiring, error } = await admin
      .from('memberships')
      .select('profile_id, expiration, profiles!inner(id, first_name, parent_id)')
      .gte('expiration', `${targetDate}T00:00:00`)
      .lt('expiration', `${targetDate}T23:59:59.999`);
    if (error) return json(500, { error: error.message });
    summary[`expiring_in_${days}d`] = expiring?.length ?? 0;
    if (!expiring?.length) continue;

    // Notify the member's own devices and, for family members, the parent's
    const notifyIds = new Set<string>();
    for (const row of expiring) {
      notifyIds.add(row.profile_id);
      const parentId = (row.profiles as { parent_id: string | null }).parent_id;
      if (parentId) notifyIds.add(parentId);
    }

    const { data: tokens } = await admin
      .from('push_tokens')
      .select('token, profile_id')
      .in('profile_id', [...notifyIds]);

    for (const t of tokens ?? []) {
      messages.push({
        to: t.token,
        title: 'Membership Renewal Reminder',
        body:
          days === 7
            ? 'Your D14 membership expires in 1 week! Renew now to keep racing.'
            : `Your D14 membership expires in ${days} days. Renew in the app anytime.`,
        sound: 'default',
      });
    }
  }

  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
    if (res.ok) {
      const result = await res.json();
      sent += (result.data ?? []).filter((t: { status: string }) => t.status === 'ok').length;
    }
  }

  return json(200, { ...summary, devices_notified: sent });
});
