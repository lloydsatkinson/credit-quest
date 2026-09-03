-- V2.0d controlled internal sandbox pilot hardening.
-- Partner signing secrets may be stored in Supabase Vault and resolved only by
-- the service-role server path. Existing environment-backed credentials remain
-- supported by application code and are unchanged by this migration.

create extension if not exists supabase_vault;

create or replace function public.get_partner_credential_vault_secret(
  p_secret_name text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, vault
as $$
declare
  v_secret text;
  v_count integer;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'vault_secret_forbidden' using errcode = '42501';
  end if;

  if p_secret_name is null
     or p_secret_name !~ '^[A-Za-z0-9._:-]{3,160}$' then
    raise exception 'vault_secret_invalid_name' using errcode = '22023';
  end if;

  select count(*), max(decrypted_secret)
    into v_count, v_secret
  from vault.decrypted_secrets
  where name = p_secret_name;

  if v_count <> 1 or v_secret is null or length(v_secret) < 32 then
    raise exception 'vault_secret_unavailable' using errcode = 'P0001';
  end if;

  return v_secret;
end;
$$;

revoke all on function public.get_partner_credential_vault_secret(text) from public;
revoke all on function public.get_partner_credential_vault_secret(text) from anon;
revoke all on function public.get_partner_credential_vault_secret(text) from authenticated;
grant execute on function public.get_partner_credential_vault_secret(text) to service_role;
