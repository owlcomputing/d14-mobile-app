-- Push notification upgrades (board request, Q3 2026).
--
--   * notification_sends: history of every push sent (manual and automatic),
--     with who sent it, the audience, and push/email delivery counts.
--   * event_notification_log: which events have already been announced or
--     reminded about, so the daily job never sends the same one twice.
--   * notification_push_targets() / notification_email_targets(): who
--     receives a send, for an audience (everyone / members / prospects) and
--     an optional list of divisions. Used only by edge functions (service role).
--
-- Audience rules:
--   * Member = the household (account holder or any family member under them)
--     has a current membership. Prospect = everyone else (app sign-ups,
--     registered-but-unpaid website accounts, expired members).
--   * Push: devices whose division filter matches (NULL = all divisions),
--     unless the person turned push off.
--   * Email (account holders only; family members share the holder's inbox):
--       members get it unless they opted out (email_marketing consent = false);
--       prospects only if they opted in (email_marketing consent = true).
--     Divisions: their saved choice (communication_preferences); members who
--     never chose are matched on the disciplines from their membership form.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Send history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_sends (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- manual = admin send screen; event_auto = daily event reminders / new events
  kind text NOT NULL CHECK (kind IN ('manual', 'event_auto')),
  sent_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  -- in-app path ('/event/12', '/division/3', '/renew', '/calendar') or https URL
  link text,
  audience text NOT NULL CHECK (audience IN ('everyone', 'members', 'prospects')),
  -- NULL = district-wide
  divisions text[],
  push_targeted integer NOT NULL DEFAULT 0,
  push_sent integer NOT NULL DEFAULT 0,
  email_requested boolean NOT NULL DEFAULT false,
  email_sent integer NOT NULL DEFAULT 0,
  -- why email was skipped or limited (e.g. 'email sending is off'), or an error
  email_note text,
  error text
);
CREATE INDEX IF NOT EXISTS notification_sends_created_idx
  ON public.notification_sends (created_at DESC);

ALTER TABLE public.notification_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read send history" ON public.notification_sends;
CREATE POLICY "Admins read send history" ON public.notification_sends
  FOR SELECT TO authenticated
  USING (private.is_admin());
-- Written only by edge functions (service role).

GRANT SELECT ON public.notification_sends TO authenticated;
GRANT ALL ON public.notification_sends TO service_role;

-- ---------------------------------------------------------------------------
-- Automatic event notifications: what has already gone out
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_notification_log (
  event_id integer NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  -- announced = included in a "new on the calendar" roundup (or seen when the
  --             job first ran); reminder = the "coming up" reminder went out
  kind text NOT NULL CHECK (kind IN ('announced', 'reminder')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, kind)
);

ALTER TABLE public.event_notification_log ENABLE ROW LEVEL SECURITY;
-- No policies: service role only.
REVOKE ALL ON public.event_notification_log FROM anon, authenticated;
GRANT ALL ON public.event_notification_log TO service_role;

-- ---------------------------------------------------------------------------
-- Audience resolution (service role only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notification_push_targets(
  p_audience text DEFAULT 'everyone',
  p_divisions text[] DEFAULT NULL
)
  RETURNS TABLE (token text, profile_id uuid, divisions text[])
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  WITH member_households AS (
    SELECT DISTINCT coalesce(p.parent_id, p.id) AS id
    FROM public.memberships m
    JOIN public.profiles p ON p.id = m.profile_id
    WHERE m.expiration >= now()
  )
  SELECT t.token, t.profile_id, t.divisions
  FROM public.push_tokens t
  JOIN public.profiles p ON p.id = t.profile_id
  WHERE (p_divisions IS NULL OR t.divisions IS NULL OR t.divisions && p_divisions)
    AND (
      p_audience = 'everyone'
      OR (p_audience = 'members') = EXISTS (
        SELECT 1 FROM member_households h WHERE h.id = coalesce(p.parent_id, p.id)
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.current_communication_consents c
      WHERE c.profile_id = t.profile_id AND c.channel = 'push' AND NOT c.granted
    )
  ORDER BY t.token
$$;

CREATE OR REPLACE FUNCTION public.notification_email_targets(
  p_audience text DEFAULT 'everyone',
  p_divisions text[] DEFAULT NULL
)
  RETURNS TABLE (profile_id uuid, email text, first_name text, is_member boolean, divisions text[])
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  WITH households AS (
    SELECT
      coalesce(p.parent_id, p.id) AS id,
      coalesce(bool_or(m.expiration >= now()), false) AS is_member,
      -- disciplines from the membership form, spelled like division names
      array_agg(DISTINCT CASE d WHEN 'Vintage MX' THEN 'Vintage Motocross' ELSE d END)
        FILTER (WHERE d IS NOT NULL) AS disciplines
    FROM public.profiles p
    LEFT JOIN public.memberships m ON m.profile_id = p.id
    LEFT JOIN LATERAL unnest(p.disciplines) AS d ON true
    GROUP BY 1
  ),
  people AS (
    SELECT
      p.id,
      lower(trim(p.email)) AS email,
      p.first_name,
      h.is_member,
      CASE
        WHEN cp.profile_id IS NOT NULL THEN cp.divisions          -- their choice (NULL = all)
        WHEN h.is_member AND cardinality(h.disciplines) > 0 THEN h.disciplines
        ELSE NULL
      END AS divisions,
      cc.granted AS email_consent
    FROM public.profiles p
    JOIN households h ON h.id = p.id
    LEFT JOIN public.communication_preferences cp ON cp.profile_id = p.id
    LEFT JOIN public.current_communication_consents cc
      ON cc.profile_id = p.id AND cc.channel = 'email_marketing'
    WHERE p.parent_id IS NULL
      AND p.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  )
  SELECT DISTINCT ON (email) id, email, first_name, is_member, divisions
  FROM people
  WHERE (p_audience = 'everyone' OR (p_audience = 'members') = is_member)
    AND CASE WHEN is_member THEN coalesce(email_consent, true) ELSE coalesce(email_consent, false) END
    AND (p_divisions IS NULL OR divisions IS NULL OR divisions && p_divisions)
  ORDER BY email, is_member DESC, id
$$;

REVOKE ALL ON FUNCTION public.notification_push_targets(text, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notification_email_targets(text, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notification_push_targets(text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.notification_email_targets(text, text[]) TO service_role;
