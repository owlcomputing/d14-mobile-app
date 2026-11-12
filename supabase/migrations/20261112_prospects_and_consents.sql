-- Prospect sign-up support (board request, Q3 2026).
--
-- A "prospect" is a normal login (email code, no password) whose profile has
-- member_type NULL and no membership: the same state the website already uses
-- for registered-but-unpaid accounts. (Using member_type = 'Prospect' would
-- make the website treat them as members: it checks member_type != null.)
-- When a prospect buys a membership on the website, the same account becomes
-- a member.
--
-- This migration adds:
--   * communication_consents: append-only log of opt-ins/opt-outs per channel
--     (push, email_marketing) with the exact wording shown and where.
--   * communication_preferences: divisions a person is interested in, plus
--     where they signed up. Used to target email by division.
--   * current_communication_consents: latest consent per person and channel.
--   * member_directory limited to members, chairmen and admins, so prospect
--     accounts can't browse the member list.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Consent log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_consents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('push', 'email_marketing')),
  granted boolean NOT NULL,
  -- where the choice was made, e.g. 'app:prospect-signup', 'app:settings'
  source text NOT NULL,
  -- exact wording the person agreed to (or turned off)
  consent_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS communication_consents_profile_channel_idx
  ON public.communication_consents (profile_id, channel, created_at DESC);

ALTER TABLE public.communication_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users record their own consent" ON public.communication_consents;
CREATE POLICY "Users record their own consent" ON public.communication_consents
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users and admins read consent" ON public.communication_consents;
CREATE POLICY "Users and admins read consent" ON public.communication_consents
  FOR SELECT TO authenticated
  USING (profile_id = (SELECT auth.uid()) OR private.is_admin());
-- No UPDATE/DELETE policies: the log is append-only (a change of mind is a new row).

GRANT SELECT, INSERT ON public.communication_consents TO authenticated;
GRANT ALL ON public.communication_consents TO service_role;

CREATE OR REPLACE VIEW public.current_communication_consents
  WITH (security_invoker = true)
AS
SELECT DISTINCT ON (profile_id, channel)
  profile_id, channel, granted, source, consent_text, created_at
FROM public.communication_consents
ORDER BY profile_id, channel, created_at DESC, id DESC;

GRANT SELECT ON public.current_communication_consents TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Preferences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_preferences (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- division names they're interested in; NULL = all divisions
  divisions text[],
  -- where the account was created, e.g. 'app:prospect-signup'
  signup_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.communication_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own preferences" ON public.communication_preferences;
CREATE POLICY "Users manage their own preferences" ON public.communication_preferences
  FOR ALL TO authenticated
  USING (profile_id = (SELECT auth.uid()))
  WITH CHECK (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins read preferences" ON public.communication_preferences;
CREATE POLICY "Admins read preferences" ON public.communication_preferences
  FOR SELECT TO authenticated
  USING (private.is_admin());

GRANT SELECT, INSERT, UPDATE ON public.communication_preferences TO authenticated;
GRANT ALL ON public.communication_preferences TO service_role;

-- ---------------------------------------------------------------------------
-- Member lookup list: members, chairmen and admins only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.can_use_member_directory()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'chairman')
  ) OR EXISTS (
    SELECT 1 FROM public.memberships m WHERE m.profile_id = auth.uid()
  )
$$;
REVOKE ALL ON FUNCTION private.can_use_member_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_use_member_directory() TO authenticated;

CREATE OR REPLACE VIEW public.member_directory
  WITH (security_invoker = false)
AS
SELECT
  p.id,
  p.first_name,
  p.last_name,
  p.d14_number,
  p.member_type,
  p.disciplines,
  m.expiration
FROM public.profiles p
LEFT JOIN public.memberships m ON m.profile_id = p.id
WHERE private.can_use_member_directory();

REVOKE ALL ON public.member_directory FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.member_directory TO authenticated;
