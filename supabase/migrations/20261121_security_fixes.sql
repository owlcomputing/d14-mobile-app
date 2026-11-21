-- Security fixes found 2026-11-21 (confirmed on staging with rolled-back tests;
-- prod had the same policies):
--   1. events: an "ALL ... USING (true)" policy let anyone, even signed out,
--      edit or delete events.
--   2. profiles: any signed-in user (including race-reminder sign-ups) could
--      set their own role to 'admin', or set parent_id to join someone
--      else's family and read their profiles.
--   3. memberships: every signed-in user could read all memberships.
--   4. renewals: any signed-in user could add renewal rows for anyone.
--   5. storage: any signed-in user could upload, overwrite or delete any file
--      (division logos, page photos, class lists, ...).

-- Helper: admins and division chairmen (website editors)
create or replace function private.is_admin_or_chairman()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'chairman')
  )
$$;
revoke all on function private.is_admin_or_chairman() from public;
grant execute on function private.is_admin_or_chairman() to authenticated;

-- Helper: the signed-in user chairs this division
create or replace function private.chairs_division(p_division_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.divisions
    where id = p_division_id and chairman_id = auth.uid()
  )
$$;
revoke all on function private.chairs_division(bigint) from public;
grant execute on function private.chairs_division(bigint) to authenticated;

------------------------------------------------------------------------------
-- 1. events: everyone reads; admins and the division's chairman write
--    (chairmen manage their own division's events in the website calendar editor)
------------------------------------------------------------------------------
drop policy if exists "Everyone can see events" on public.events;
drop policy if exists "Admins can update events" on public.events; -- was a duplicate INSERT policy
drop policy if exists "Admins can insert events" on public.events;
drop policy if exists "Admins can delete events" on public.events;

drop policy if exists "Admins and chairmen can insert events" on public.events;
drop policy if exists "Admins and chairmen can update events" on public.events;
drop policy if exists "Admins and chairmen can delete events" on public.events;
create policy "Everyone can see events" on public.events
  for select to public using (true);
create policy "Admins and chairmen can insert events" on public.events
  for insert to authenticated
  with check ((select private.is_admin()) or private.chairs_division(division_id));
create policy "Admins and chairmen can update events" on public.events
  for update to authenticated
  using ((select private.is_admin()) or private.chairs_division(division_id))
  with check ((select private.is_admin()) or private.chairs_division(division_id));
create policy "Admins and chairmen can delete events" on public.events
  for delete to authenticated
  using ((select private.is_admin()) or private.chairs_division(division_id));

------------------------------------------------------------------------------
-- 2. profiles: only admins (and server code) change role, parent_id,
--    d14_number or organization_id
------------------------------------------------------------------------------
create or replace function private.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
begin
  -- Edge functions (service role) and direct database connections aren't limited
  if request_role not in ('anon', 'authenticated') then
    return new;
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role is not null or new.parent_id is not null or new.organization_id is not null then
      raise exception 'Only an admin can set role, family or organization'
        using errcode = '42501';
    end if;
    new.d14_number := null; -- assigned by before_insert_set_d14_number
  elsif new.role is distinct from old.role
     or new.parent_id is distinct from old.parent_id
     or new.d14_number is distinct from old.d14_number
     or new.organization_id is distinct from old.organization_id then
    raise exception 'Only an admin can change role, family, D14 number or organization'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.protect_profile_columns() from public;

-- Named to sort before before_insert_set_d14_number (BEFORE triggers run in name order)
drop trigger if exists a_protect_profile_columns on public.profiles;
create trigger a_protect_profile_columns
  before insert or update on public.profiles
  for each row execute function private.protect_profile_columns();

------------------------------------------------------------------------------
-- 3. memberships: admins, the member, and their family (same people whose
--    profiles they can see). Gate lookups use the member_directory view.
------------------------------------------------------------------------------
drop policy if exists "Authenticated users can view memberships" on public.memberships;
drop policy if exists "Family can see memberships" on public.memberships;
create policy "Family can see memberships" on public.memberships
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = memberships.profile_id));

------------------------------------------------------------------------------
-- 4. renewals: only for yourself or your family; parent_id must be you or
--    the member's real parent
------------------------------------------------------------------------------
drop policy if exists "Insert for Auth users" on public.renewals;
drop policy if exists "Users can manage their family renewals" on public.renewals;

create or replace function private.can_renew(p_id uuid, p_parent_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_id
      and (
        p.id = auth.uid()
        or p.parent_id = auth.uid()
        or p.id = (select parent_id from public.profiles where id = auth.uid())
        or p.parent_id = (select parent_id from public.profiles where id = auth.uid())
      )
      and (p_parent_id = auth.uid() or p_parent_id is not distinct from p.parent_id)
  )
$$;
revoke all on function private.can_renew(uuid, uuid) from public;
grant execute on function private.can_renew(uuid, uuid) to authenticated;

drop policy if exists "Users can add family renewals" on public.renewals;
drop policy if exists "Users can update family renewals" on public.renewals;
create policy "Users can add family renewals" on public.renewals
  for insert to authenticated
  with check ((select private.is_admin()) or private.can_renew(id, parent_id));
create policy "Users can update family renewals" on public.renewals
  for update to authenticated
  using ((select auth.uid()) = id or (select auth.uid()) = parent_id)
  with check ((select private.is_admin()) or private.can_renew(id, parent_id));
-- (SELECT and DELETE of your own/family rows: existing policies)

------------------------------------------------------------------------------
-- 5. storage: anyone can read (public buckets); only admins and chairmen
--    upload, change or delete files
------------------------------------------------------------------------------
drop policy if exists "Authenticated can delete any objects" on storage.objects;
drop policy if exists "Authenticated can insert any objects" on storage.objects;
drop policy if exists "Authenticated can update any objects" on storage.objects;
drop policy if exists "Authenticated can read any objects" on storage.objects; -- covered by the public read policy
-- Staging's copies of the same open policies had different names
drop policy if exists "Allow authenticated uploads" on storage.objects;
drop policy if exists "Allow authenticated deletes" on storage.objects;
drop policy if exists "Allow update for authenticated users" on storage.objects;
drop policy if exists "Editors can upload site files" on storage.objects;
drop policy if exists "Editors can update site files" on storage.objects;
drop policy if exists "Editors can delete site files" on storage.objects;

create policy "Editors can upload site files" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('Images', 'media') and (select private.is_admin_or_chairman()));
create policy "Editors can update site files" on storage.objects
  for update to authenticated
  using (bucket_id in ('Images', 'media') and (select private.is_admin_or_chairman()))
  with check (bucket_id in ('Images', 'media') and (select private.is_admin_or_chairman()));
create policy "Editors can delete site files" on storage.objects
  for delete to authenticated
  using (bucket_id in ('Images', 'media') and (select private.is_admin_or_chairman()));
