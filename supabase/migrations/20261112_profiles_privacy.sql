-- Security fix: stop every signed-in user from reading every member's
-- profile. "Authenticated users can see profile" was USING (true), so anyone
-- who created a free account could download all members' home addresses,
-- phone numbers, birthdates and emails.
--
-- After this migration:
--   * profiles: a signed-in user can read their own profile, their family
--     (their children, or as a child: their parent and siblings), and admins
--     can read everyone. Users can only insert their own profile.
--   * member_directory (new view): name, D14 #, member type, disciplines and
--     membership expiration for every member, readable by signed-in users.
--     Used by the app's member lookup and QR gate scanner, which previously
--     read profiles directly.
--   * set_d14_number trigger runs with owner rights so it still sees every
--     profile when picking the next D14 number (otherwise a new user would
--     only see their own row and get a duplicate number).
--
-- Access paths audited 2026-11-12 (website d14-angular + mobile app):
--   own profile (auth, header, landing, checkout, profile, membership pages),
--   family via parent_id (profile/membership/checkout pages, app family list),
--   chairman reading their own name (cms page), admin pages (is_admin),
--   signup inserting own row (login page / auth.service), service-role edge
--   functions (bypass RLS).
--
-- Safe to re-run.

-- Caller's parent id, read with owner rights. Used inside the profiles
-- policy, where a plain subquery on profiles would recurse into the policy.
CREATE OR REPLACE FUNCTION private.my_parent_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT parent_id FROM public.profiles WHERE id = auth.uid()
$$;
REVOKE ALL ON FUNCTION private.my_parent_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.my_parent_id() TO authenticated;

-- Reads: self, family, admins.
DROP POLICY IF EXISTS "Authenticated users can see profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can see their own and family profiles" ON public.profiles;
CREATE POLICY "Users can see their own and family profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    private.is_admin()
    OR id = (SELECT auth.uid())
    OR parent_id = (SELECT auth.uid())
    OR id = (SELECT private.my_parent_id())
    OR parent_id = (SELECT private.my_parent_id())
  );

-- Inserts: own profile only (was WITH CHECK (true)). Child accounts are
-- created by the createUser edge function with the service role.
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
CREATE POLICY "Users can create their own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()) OR private.is_admin());

-- Next D14 number must be computed over all profiles, not just the ones the
-- inserting user can see.
ALTER FUNCTION public.set_d14_number() SECURITY DEFINER;
ALTER FUNCTION public.set_d14_number() SET search_path = public, pg_temp;

-- Limited member list for gate checks (app lookup + QR scanner). Runs with
-- the view owner's rights so it is not limited by the profiles policy above;
-- it only exposes non-sensitive columns.
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
LEFT JOIN public.memberships m ON m.profile_id = p.id;

REVOKE ALL ON public.member_directory FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.member_directory TO authenticated;
