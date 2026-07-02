-- Ensure no two membership_receipts can share a stripe session id.
-- This is the natural idempotency key for fulfillment (sync path + webhook backstop).
--
-- Before adding the constraint, verify no existing duplicates would block it.
-- If duplicates exist, the DO block aborts the migration with a list — those
-- rows are evidence of prior fulfillment bugs and need human review (do NOT
-- auto-delete). NULLs are fine: Postgres unique constraints allow multiple NULLs.
do $$
declare
  duplicate_list text;
begin
  select string_agg(stripe_transaction_id || ' (' || cnt || ' rows)', E'\n  ')
    into duplicate_list
  from (
    select stripe_transaction_id, count(*) as cnt
    from membership_receipts
    where stripe_transaction_id is not null
    group by stripe_transaction_id
    having count(*) > 1
  ) dups;

  if duplicate_list is not null then
    raise exception
      'Cannot add unique constraint: duplicate stripe_transaction_id values found in membership_receipts. Resolve manually before re-running. Duplicates:%s  %s',
      E'\n', duplicate_list;
  end if;
end$$;

alter table public.membership_receipts
  add constraint membership_receipts_stripe_transaction_id_unique
  unique (stripe_transaction_id);
