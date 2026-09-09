-- V2.3 lender pilot reporting privilege and historical-truth checks.
begin;

do $$
declare
  private_tables text[] := array['recovery_pilots','recovery_pilot_assignments','lender_portal_members'];
begin
  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = any(private_tables)
      and grantee in ('anon','authenticated')
  ) then
    raise exception 'V2.3 lender portal tables must have no client grants';
  end if;

  if (
    select count(*) from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any(private_tables)
      and c.relrowsecurity
  ) <> array_length(private_tables, 1) then
    raise exception 'Every V2.3 lender portal table must have RLS enabled';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lender_portal_members' and column_name = 'user_id'
  ) then
    raise exception 'Lender membership must bind the authenticated user id';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'decline_recovery_journeys' and column_name = 'first_ready_to_check_at'
  ) then
    raise exception 'Historical first-ready timestamp is required';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'return_attempts' and column_name = 'route_type'
  ) then
    raise exception 'Return attempts must distinguish original and alternative route types';
  end if;
end $$;

rollback;
