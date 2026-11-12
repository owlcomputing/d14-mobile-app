-- Fix: charter (club) membership signup on the website was failing for
-- non-admins. membership.component.ts inserts the club into organizations as
-- the signed-in user (organization_user_id = their own id), then reads it back.
-- The only non-admin policy, misleadingly named "Primary Contacts can insert",
-- is a SELECT policy, so every non-admin insert was rejected by RLS.
--
-- Safe to re-run.

DROP POLICY IF EXISTS "Primary contacts can create their organization" ON public.organizations;
CREATE POLICY "Primary contacts can create their organization" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (organization_user_id = (SELECT auth.uid()));

-- Rename the existing SELECT policy so its name matches what it does.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.organizations'::regclass
             AND polname = 'Primary Contacts can insert') THEN
    ALTER POLICY "Primary Contacts can insert" ON public.organizations
      RENAME TO "Primary contacts can view their organization";
  END IF;
END $$;
