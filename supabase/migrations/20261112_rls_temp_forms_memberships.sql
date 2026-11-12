-- Security fix: enable row-level security on temp_membership_form_data and
-- memberships. Both tables had RLS disabled, so anyone holding the public anon
-- key (shipped in the website and app) could read, insert, update and delete
-- every row, including membership-form PII (names, birthdates, addresses,
-- phones, emergency contacts, signatures).
--
-- Access paths this preserves (audited 2026-11-12):
--   * Edge functions (fulfillment, create-checkout-session, createUser,
--     updateUser, importUsers, checkout-return, renewal-reminders) use the
--     service-role key, which bypasses RLS.
--   * cleanup-temp-memberships pg_cron job runs as the table owner.
--   * Website membership signup: the form is held in localStorage until the
--     user is signed in; rows are inserted/read/deleted by the signed-in user
--     with user_id = self, or parent_id = self for family members. A family
--     member (child) account may also clear/insert rows for its parent.
--   * Website admin pages (users, organizations, reports, emails) read and
--     update memberships and read temp form rows as role = 'admin'.
--   * Website checkout/profile and the app's member lookup, QR scanner and
--     family list read other members' membership expirations while signed in
--     (profiles are already readable by any signed-in user).
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- temp_membership_form_data: signed-in users see/manage only their family's
-- rows; admins see/manage all.
-- ---------------------------------------------------------------------------

-- Was WITH CHECK (true): any signed-in user could insert rows for anyone.
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.temp_membership_form_data;
DROP POLICY IF EXISTS "Family can manage their own form data" ON public.temp_membership_form_data;

CREATE POLICY "Family can manage their own form data" ON public.temp_membership_form_data
  FOR ALL TO authenticated
  USING (
    private.is_admin()
    OR user_id = (SELECT auth.uid())
    OR parent_id = (SELECT auth.uid())
    OR user_id = (SELECT p.parent_id FROM public.profiles p WHERE p.id = (SELECT auth.uid()))
    OR parent_id = (SELECT p.parent_id FROM public.profiles p WHERE p.id = (SELECT auth.uid()))
  )
  WITH CHECK (
    private.is_admin()
    OR user_id = (SELECT auth.uid())
    OR parent_id = (SELECT auth.uid())
    OR user_id = (SELECT p.parent_id FROM public.profiles p WHERE p.id = (SELECT auth.uid()))
    OR parent_id = (SELECT p.parent_id FROM public.profiles p WHERE p.id = (SELECT auth.uid()))
  );

ALTER TABLE public.temp_membership_form_data ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- memberships: readable by any signed-in user (gate checks, family views);
-- writable only by admins. Signed-out users get nothing.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can view memberships" ON public.memberships;
DROP POLICY IF EXISTS "Admins can insert memberships" ON public.memberships;
DROP POLICY IF EXISTS "Admins can update memberships" ON public.memberships;
DROP POLICY IF EXISTS "Admins can delete memberships" ON public.memberships;

CREATE POLICY "Authenticated users can view memberships" ON public.memberships
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert memberships" ON public.memberships
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

CREATE POLICY "Admins can update memberships" ON public.memberships
  FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "Admins can delete memberships" ON public.memberships
  FOR DELETE TO authenticated
  USING (private.is_admin());

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
