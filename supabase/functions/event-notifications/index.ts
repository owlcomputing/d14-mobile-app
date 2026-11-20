// Daily job (pg_cron, x-cron-secret header): automatic event notifications.
//
//   * Reminder: events 1–3 days away that haven't had one get a push
//     ("Coming up Saturday…"). Normally that's exactly 3 days out; the window
//     catches events added late or a missed run.
//   * New on the calendar: events added since the last run get ONE roundup
//     push per device ("12 new events: Enduro (5), Motocross (7)"), so
//     loading a season's schedule doesn't send a push per event.
//   * Email: each person gets at most one email per run, combining their
//     reminders and new events (see _shared/notify.ts for who gets email).
//
// Everyone receives only events in divisions they follow (district-wide
// events, with no division, go to everyone). Sent events are recorded in
// event_notification_log, so nothing goes out twice. The first run only
// records the existing calendar, so it doesn't announce every event at once.
//
// Body (optional): { "dryRun": true } returns what would be sent without
// sending or recording anything.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

import {
  adminClient,
  applyEmailMode,
  follows,
  getEmailTargets,
  getPushTargets,
  logSend,
  renderEmail,
  sendEmail,
  sendPush,
  SITE_URL,
  type EmailItem,
  type EmailSection,
  type EmailTarget,
  type PushMessage,
} from '../_shared/notify.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const TIME_ZONE = 'America/Detroit';
const REMINDER_DAYS = 3;

type CalEvent = {
  id: number;
  name: string;
  /** YYYY-MM-DD */
  day: string;
  location: string | null;
  division: string | null;
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Today's date in Michigan, YYYY-MM-DD */
const localToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const formatDay = (day: string, style: 'long' | 'short' = 'long') =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: style,
    month: style === 'long' ? 'long' : 'short',
    day: 'numeric',
  });

const weekday = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long' });

const eventMeta = (e: CalEvent) =>
  [e.division, formatDay(e.day), e.location].filter(Boolean).join(' · ');

/** "Enduro (5), Motocross (2)" */
function divisionCounts(events: CalEvent[]) {
  const counts = new Map<string, number>();
  for (const e of events) {
    const k = e.division ?? 'District';
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts].map(([k, n]) => `${k} (${n})`).join(', ');
}

serve(async (req: Request): Promise<Response> => {
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return json(401, { error: 'Unauthorized' });
  }
  const options = await req.json().catch(() => ({}));
  const dryRun = options?.dryRun === true;

  try {
    const admin = adminClient();
    const today = localToday();
    const horizon = addDays(today, REMINDER_DAYS);

    // --- Calendar ---------------------------------------------------------------
    const [{ data: divisions, error: divError }, { data: rows, error: evError }] =
      await Promise.all([
        admin.from('divisions').select('id, name'),
        admin
          .from('events')
          .select('id, name, date, location_name, division_id')
          .gte('date', today)
          .order('date')
          .limit(1000),
      ]);
    if (divError || evError) throw new Error((divError ?? evError)!.message);
    const divisionName = new Map((divisions ?? []).map((d) => [d.id, d.name as string | null]));
    const upcoming: CalEvent[] = (rows ?? []).map((r) => ({
      id: r.id,
      name: r.name?.trim() || 'D14 event',
      day: String(r.date).slice(0, 10),
      location: r.location_name?.trim() || null,
      division: r.division_id ? (divisionName.get(r.division_id) ?? null) : null,
    }));

    // --- What's already gone out ---------------------------------------------
    const { count: logCount, error: countError } = await admin
      .from('event_notification_log')
      .select('event_id', { count: 'exact', head: true });
    if (countError) throw new Error(countError.message);
    const firstRun = !logCount;

    const done = new Set<string>();
    if (upcoming.length) {
      const { data: logRows, error } = await admin
        .from('event_notification_log')
        .select('event_id, kind')
        .in('event_id', upcoming.map((e) => e.id));
      if (error) throw new Error(error.message);
      for (const r of logRows ?? []) done.add(`${r.kind}:${r.event_id}`);
    }

    const reminders = upcoming.filter(
      (e) => e.day > today && e.day <= horizon && !done.has(`reminder:${e.id}`),
    );
    const reminderIds = new Set(reminders.map((e) => e.id));
    // Events close enough for a reminder get that instead of a "new" listing
    const unannounced = upcoming.filter((e) => !done.has(`announced:${e.id}`));
    const newEvents = firstRun ? [] : unannounced.filter((e) => !reminderIds.has(e.id));

    // --- Record before sending, so a failure part-way never double-sends -------
    if (!dryRun) {
      const log = [
        ...unannounced.map((e) => ({ event_id: e.id, kind: 'announced' })),
        ...reminders.map((e) => ({ event_id: e.id, kind: 'reminder' })),
      ];
      if (firstRun) {
        // Baseline: past events too, so a later run never mistakes the job for new
        const { data: past } = await admin
          .from('events')
          .select('id')
          .lt('date', today)
          .order('date', { ascending: false })
          .limit(1000);
        log.push(...(past ?? []).map((e) => ({ event_id: e.id, kind: 'announced' })));
      }
      if (log.length) {
        const { error } = await admin
          .from('event_notification_log')
          .upsert(log, { onConflict: 'event_id,kind', ignoreDuplicates: true });
        if (error) throw new Error(error.message);
      }
    }

    if (!reminders.length && !newEvents.length) {
      return json(200, { today, firstRun, reminders: 0, newEvents: 0, dryRun });
    }

    // --- Push -------------------------------------------------------------------
    const devices = await getPushTargets(admin, 'everyone', null);
    const messages: PushMessage[] = [];
    for (const d of devices) {
      for (const e of reminders) {
        if (!follows(d.divisions, e.division)) continue;
        messages.push({
          to: d.token,
          title: `Coming up ${weekday(e.day)}: ${e.name}`,
          body: `${eventMeta(e)}. Tap for details.`,
          data: { url: `/event/${e.id}` },
        });
      }
      const mine = newEvents.filter((e) => follows(d.divisions, e.division));
      if (mine.length === 1) {
        const e = mine[0];
        messages.push({
          to: d.token,
          title: 'New on the D14 calendar',
          body: `${e.name}: ${eventMeta(e)}`,
          data: { url: `/event/${e.id}` },
        });
      } else if (mine.length > 1) {
        messages.push({
          to: d.token,
          title: 'New on the D14 calendar',
          body: `${mine.length} new events: ${divisionCounts(mine)}. Tap to see the calendar.`,
          data: { url: '/calendar' },
        });
      }
    }

    // --- Email: one combined email per person -------------------------------------
    const people = await getEmailTargets(admin, 'everyone', null);
    const { targets: emailTargets, note: emailNote } = applyEmailMode(people);
    const emailAllowed = new Set(emailTargets.map((t) => t.profile_id));
    // Group people who get exactly the same items, so each group is one SendGrid request
    const groups = new Map<string, { reminders: CalEvent[]; added: CalEvent[]; people: EmailTarget[] }>();
    let emailWouldSend = 0;
    for (const p of people) {
      const r = reminders.filter((e) => follows(p.divisions, e.division));
      const n = newEvents.filter((e) => follows(p.divisions, e.division));
      if (!r.length && !n.length) continue;
      emailWouldSend++;
      if (!emailAllowed.has(p.profile_id)) continue;
      const key = [...r.map((e) => `r${e.id}`), ...n.map((e) => `n${e.id}`)].join(',');
      const g = groups.get(key) ?? { reminders: r, added: n, people: [] };
      g.people.push(p);
      groups.set(key, g);
    }

    if (dryRun) {
      return json(200, {
        today,
        firstRun,
        dryRun,
        reminders: reminders.map((e) => `${e.day} ${e.division ?? 'District'}: ${e.name}`),
        newEvents: newEvents.map((e) => `${e.day} ${e.division ?? 'District'}: ${e.name}`),
        pushMessages: messages.length,
        devices: devices.length,
        emailRecipients: emailWouldSend,
        emailGroups: groups.size,
        emailNote,
      });
    }

    const push = await sendPush(admin, messages);

    let emailSent = 0;
    const errors = [...push.errors];
    const eventItem = (e: CalEvent): EmailItem => ({
      title: e.name,
      meta: eventMeta(e),
      url: `${SITE_URL}/secure/event/${e.id}`,
    });
    for (const g of groups.values()) {
      const sections: EmailSection[] = [];
      if (g.reminders.length) {
        sections.push({ heading: 'Coming up', items: g.reminders.map(eventItem) });
      }
      if (g.added.length) {
        sections.push({ heading: 'New on the calendar', items: g.added.map(eventItem) });
      }
      const total = g.reminders.length + g.added.length;
      const subject =
        total === 1 && g.reminders.length
          ? `Coming up ${weekday(g.reminders[0].day)}: ${g.reminders[0].name}`
          : total === 1
            ? `New on the D14 calendar: ${g.added[0].name}`
            : g.reminders.length && g.added.length
              ? `D14 events: ${g.reminders.length} coming up, ${g.added.length} new`
              : g.reminders.length
                ? `${g.reminders.length} D14 events coming up`
                : `${g.added.length} new events on the D14 calendar`;
      sections.push({
        items: [{ url: `${SITE_URL}/secure/calendar`, cta: 'See the full calendar' }],
      });
      const content = renderEmail({ heading: subject, sections });
      const result = await sendEmail(g.people, subject, content);
      emailSent += result.sent;
      errors.push(...result.errors);
    }

    // --- History --------------------------------------------------------------------
    const summary = [
      reminders.length
        ? `Reminders: ${reminders.map((e) => `${e.name} (${formatDay(e.day, 'short')})`).join(', ')}`
        : null,
      newEvents.length ? `New on the calendar: ${newEvents.length} (${divisionCounts(newEvents)})` : null,
    ]
      .filter(Boolean)
      .join('\n');
    const involved = [...new Set([...reminders, ...newEvents].map((e) => e.division))];
    await logSend(admin, {
      kind: 'event_auto',
      title: 'Automatic event notifications',
      body: summary,
      link: null,
      audience: 'everyone',
      divisions: involved.includes(null) ? null : (involved as string[]),
      push_targeted: messages.length,
      push_sent: push.sent,
      email_requested: true,
      email_sent: emailSent,
      email_note: emailNote,
      error: errors.length ? [...new Set(errors)].join('; ').slice(0, 1000) : null,
    });

    return json(200, {
      today,
      reminders: reminders.length,
      newEvents: newEvents.length,
      pushSent: push.sent,
      pushMessages: messages.length,
      emailSent,
      emailNote,
      errors: errors.length ? [...new Set(errors)] : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('event-notifications failed', message);
    return json(500, { error: message });
  }
});
