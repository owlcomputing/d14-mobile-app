-- Website email newsletters (Admin › Notifications › Email newsletter), sent
-- by the send-newsletter edge function.
--
-- newsletter_recipients(divisions, picked emails) returns one row per address:
--   * everyone whose profile lists one of `p_divisions` in its disciplines
--     (same selection the website used before: any profile, family members
--     included, membership current or not), by_division = true
--   * each address in `p_emails` (members picked by name, charter clubs),
--     by_division = false
-- with the household's account holder, whether the household has a current
-- membership, and whether the account holder unsubscribed from email
-- (latest email_marketing consent = off). The function decides who to skip:
-- division recipients who unsubscribed are left out; picked addresses always
-- get the email.

CREATE OR REPLACE FUNCTION public.newsletter_recipients(
  p_divisions text[] DEFAULT NULL,
  p_emails text[] DEFAULT NULL
)
  RETURNS TABLE (
    email text,
    holder_id uuid,
    is_member boolean,
    opted_out boolean,
    by_division boolean
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  WITH division_people AS (
    SELECT lower(trim(p.email)) AS email, coalesce(p.parent_id, p.id) AS holder_id, true AS by_division
    FROM public.profiles p
    WHERE p_divisions IS NOT NULL
      AND p.disciplines && p_divisions
      AND coalesce(trim(p.email), '') <> ''
  ),
  picked_input AS (
    SELECT DISTINCT lower(trim(e)) AS email
    FROM unnest(coalesce(p_emails, '{}'::text[])) AS e
    WHERE coalesce(trim(e), '') <> ''
  ),
  picked AS (
    -- An address can belong to several profiles; prefer the account holder
    SELECT DISTINCT ON (i.email) i.email, coalesce(p.parent_id, p.id) AS holder_id, false AS by_division
    FROM picked_input i
    LEFT JOIN public.profiles p ON lower(trim(p.email)) = i.email
    ORDER BY i.email, (p.parent_id IS NULL) DESC
  ),
  everyone AS (
    SELECT * FROM division_people
    UNION ALL
    SELECT * FROM picked
  ),
  member_households AS (
    SELECT DISTINCT coalesce(p.parent_id, p.id) AS id
    FROM public.memberships m
    JOIN public.profiles p ON p.id = m.profile_id
    WHERE m.expiration >= now()
  ),
  unsubscribed AS (
    SELECT c.profile_id
    FROM public.current_communication_consents c
    WHERE c.channel = 'email_marketing' AND NOT c.granted
  )
  SELECT
    e.email,
    e.holder_id,
    mh.id IS NOT NULL AS is_member,
    u.profile_id IS NOT NULL AS opted_out,
    e.by_division
  FROM everyone e
  LEFT JOIN member_households mh ON mh.id = e.holder_id
  LEFT JOIN unsubscribed u ON u.profile_id = e.holder_id
  ORDER BY e.email, e.by_division, e.holder_id
$$;

REVOKE ALL ON FUNCTION public.newsletter_recipients(text[], text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.newsletter_recipients(text[], text[]) TO service_role;
