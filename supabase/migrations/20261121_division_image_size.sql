-- Division page images (2026-11-21)
--
-- 1. divisions.main_img_width: the main image's size on the division page, as
--    a percentage of the page width (set by the chairman in the website
--    editor). NULL = the photo's own size, shrunk to fit.
-- 2. divisions.logo / main_img were still links to the old website
--    (ama-d14.org/assets/...), which now returns a web page instead of the
--    image, so the app showed blank division banners. The website finds the
--    current logo and main image by file name in the Images bucket
--    ("<division name>-logo-<timestamp>"); from now on its editor also saves
--    the link here. This sets each to the newest uploaded file, or NULL when
--    there's none (the website shows none either).

alter table public.divisions
  add column if not exists main_img_width smallint
    check (main_img_width between 10 and 100);

do $$
declare
  base text;
begin
  -- This project's public Storage URL, from the division page photos that
  -- scripts/migrate-cms-images.mjs (d14-angular) uploaded to this project.
  -- (Pages can also link to another project's files, e.g. staging copies.)
  select substring(content from '(https://[a-z0-9]+\.supabase\.co)/storage/v1/object/public/Images/cms/divisions/')
    into base
    from public.division_cms_content
    where content ~ 'https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/Images/cms/divisions/'
    limit 1;
  if base is null then
    raise notice 'No Storage links found; logo/main_img not changed';
    return;
  end if;

  update public.divisions d
  set logo = (
        select base || '/storage/v1/object/public/Images/' || replace(o.name, ' ', '%20')
        from storage.objects o
        where o.bucket_id = 'Images' and o.name like d.name || '-logo-%'
        order by o.name desc
        limit 1
      ),
      main_img = (
        select base || '/storage/v1/object/public/Images/' || replace(o.name, ' ', '%20')
        from storage.objects o
        where o.bucket_id = 'Images' and o.name like d.name || '-main-%'
        order by o.name desc
        limit 1
      );
end $$;
