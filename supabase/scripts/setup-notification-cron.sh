#!/usr/bin/env bash
# Set up (or rotate) the daily notification jobs for one Supabase project:
#
#   renewal-reminders-daily     15:00 UTC  push renewal reminders (30 / 7 days)
#   event-notifications-daily   14:00 UTC  event reminders + new-event roundup
#                                          (9 AM Michigan in winter, 10 AM in summer)
#
# Generates a fresh CRON_SECRET, stores it as a function secret, and
# (re)schedules both pg_cron jobs with it. The secret is never printed.
# Safe to re-run; each run rotates the secret.
#
# Usage:  supabase/scripts/setup-notification-cron.sh <project-ref>
#   staging: svcvixdghblhmoehwnnp    prod: qxoroicvatularpyltbx
# Needs the Supabase CLI, logged in with access to the project.
set -euo pipefail

REF="${1:?usage: $0 <project-ref>}"
URL="https://${REF}.supabase.co/functions/v1"
SECRET="$(openssl rand -hex 24)"
SQL="$(mktemp)"
trap 'rm -f "$SQL"' EXIT
chmod 600 "$SQL"

echo "Setting CRON_SECRET on ${REF}…"
supabase secrets set --project-ref "$REF" "CRON_SECRET=${SECRET}" >/dev/null

# Function secrets reach running functions within a few seconds
sleep 5

cat >"$SQL" <<EOF
SELECT cron.unschedule(jobname) FROM cron.job
WHERE jobname IN ('renewal-reminders-daily', 'event-notifications-daily');

SELECT cron.schedule('renewal-reminders-daily', '0 15 * * *', \$job\$
  SELECT net.http_post(
    url := '${URL}/renewal-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '${SECRET}'),
    body := '{}'::jsonb
  )
\$job\$);

SELECT cron.schedule('event-notifications-daily', '0 14 * * *', \$job\$
  SELECT net.http_post(
    url := '${URL}/event-notifications',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '${SECRET}'),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  )
\$job\$);

SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
EOF

echo "Scheduling jobs…"
supabase db query --linked --project-ref "$REF" -f "$SQL" 2>/dev/null |
  python3 -c "import json,sys; [print('  ', r['jobname'], r['schedule'], 'active' if r['active'] else 'INACTIVE') for r in json.load(sys.stdin)['rows']]"

echo "Checking the new secret works (dry run, sends nothing)…"
curl -s -X POST "${URL}/event-notifications" \
  -H "x-cron-secret: ${SECRET}" -H 'Content-Type: application/json' \
  -d '{"dryRun":true}'
echo
