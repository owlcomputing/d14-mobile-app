-- Link each division chair to their division, so the app's division page can
-- open that division's contacts. Officers (district-wide) stay null.
-- Admins set it in the website's Contact Management.

alter table public.contacts
  add column if not exists division_id bigint
  references public.divisions (id) on delete set null;

create index if not exists contacts_division_id_idx on public.contacts (division_id);

-- Current chairs (contact ids and division ids are the same in staging and prod)
update public.contacts c
set division_id = m.division_id
from (values
  (6, 14),   -- Enduro Chair            -> Enduro
  (7, 20),   -- Flat Track/TT Chair     -> Flat Track
  (8, 18),   -- Hare Scrambles Chair    -> Hare Scrambles
  (9, 41),   -- ATV XC Chair            -> ATV Hare Scrambles
  (11, 19),  -- Hill Climb Chair        -> Hill Climb
  (12, 21),  -- Ice Chair               -> Ice Racing
  (13, 15),  -- MX Chair                -> Motocross
  (14, 17),  -- Vintage MX Chair        -> Vintage Motocross
  (15, 16),  -- ATV MX Chair            -> ATV Motocross
  (19, 22)   -- Sprint Enduro Chair     -> Michigan Sprint Enduro
) as m (contact_id, division_id)
where c.id = m.contact_id
  and c.division_id is null;
