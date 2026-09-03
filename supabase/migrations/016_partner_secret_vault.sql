-- V2.0d sandbox pilot secret isolation.
-- Partner HMAC secrets may be stored encrypted in Supabase Vault and resolved
-- only through this service-role-only RPC. This migration enables no feature flag.

create or replace function public.get_partner_secret_from_vault(
  p_secret_name text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_secret text;
begin
  if p_secret_name is null
     or p_secret_name !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,159}$' then
    raise exception 'partner_secret_unavailable';
  end if;

  select ds.decrypted_secret
  into v_secret
  from vault.decrypted_secrets as ds
  where ds.name = p_secret_name;

  if not found or v_secret is null or length(v_secret) < 32 then
    raise exception 'partner_secret_unavailable';
  end if;

  return v_secret;
end;
$$;

revoke all on function public.get_partner_secret_from_vault(text) from public, anon, authenticated;
grant execute on function public.get_partner_secret_from_vault(text) to service_role;
