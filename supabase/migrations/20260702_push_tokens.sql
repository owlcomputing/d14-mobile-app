-- Expo push notification device tokens (one row per device)
CREATE TABLE IF NOT EXISTS public.push_tokens (
  token text PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform text,
  divisions text[],          -- division names the user wants notifications for (null = all)
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own push tokens" ON public.push_tokens
  FOR ALL TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

GRANT ALL ON public.push_tokens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;
