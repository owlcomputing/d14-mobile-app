-- Security fix (part 2): enable row-level security on the remaining public
-- tables that had it disabled. With RLS off, anyone holding the public anon
-- key could insert, update and delete rows (e.g. wipe all division rules or
-- division media). Existing policies were already written for these tables
-- but were never enforced; this adds the few that were missing so current
-- website/app behavior keeps working once RLS is on.
--
-- Access paths this preserves (audited 2026-11-12):
--   * Public website + app (signed out): read rules, division_media,
--     magazine_issues.
--   * Admins (website /admin): insert/update/delete rules, division_media,
--     magazines; read emails.
--   * Chairmen (website /admin/cms/:id and /admin/rules-cms/:id for their
--     own division): insert/update/delete their division's media (policies
--     already existed) and update their division's rules (added here).
--   * Service-role edge functions bypass RLS.
--
-- Safe to re-run.

-- Pre-existing UPDATE policies were written with only WITH CHECK and no
-- USING. Once RLS is enforced, an UPDATE policy without USING matches no
-- rows, so admins/chairmen could not edit anything. Give each a USING clause
-- equal to its check.
ALTER POLICY "Admins can update rules" ON public.rules
  USING (private.is_admin());
ALTER POLICY "Admins can update magazines" ON public.magazine_issues
  USING (private.is_admin());
ALTER POLICY "Admins can update division media" ON public.division_media
  USING (private.is_admin());
ALTER POLICY "Chairman can update division media for their division" ON public.division_media
  USING ((SELECT divisions.chairman_id FROM public.divisions WHERE divisions.id = division_media.division_id) = auth.uid());

-- division_media: had no SELECT policy and no admin DELETE policy.
DROP POLICY IF EXISTS "Everyone can view division media" ON public.division_media;
DROP POLICY IF EXISTS "Admins can delete division media" ON public.division_media;
CREATE POLICY "Everyone can view division media" ON public.division_media
  FOR SELECT USING (true);
CREATE POLICY "Admins can delete division media" ON public.division_media
  FOR DELETE TO authenticated USING (private.is_admin());
ALTER TABLE public.division_media ENABLE ROW LEVEL SECURITY;

-- rules: chairmen edit their own division's rules on the website.
DROP POLICY IF EXISTS "Chairman can update rules for their division" ON public.rules;
CREATE POLICY "Chairman can update rules for their division" ON public.rules
  FOR UPDATE TO authenticated
  USING ((SELECT d.chairman_id FROM public.divisions d WHERE d.id = rules.division_id) = (SELECT auth.uid()))
  WITH CHECK ((SELECT d.chairman_id FROM public.divisions d WHERE d.id = rules.division_id) = (SELECT auth.uid()));
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;

-- magazine_issues: "Everyone can view magazines" was FOR ALL USING (true),
-- which would let anyone insert/update/delete even with RLS on.
DROP POLICY IF EXISTS "Everyone can view magazines" ON public.magazine_issues;
CREATE POLICY "Everyone can view magazines" ON public.magazine_issues
  FOR SELECT USING (true);
ALTER TABLE public.magazine_issues ENABLE ROW LEVEL SECURITY;

-- emails: admin read policy already exists; writes come from service role.
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

-- Empty legacy tables: no client access at all (service role only).
ALTER TABLE public.memberships_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.old_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles_backup ENABLE ROW LEVEL SECURITY;
