-- Event venue/location for maps & directions in the mobile app.
-- Additive; the website calendar editor can adopt these fields later.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS location_name text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS address text;
