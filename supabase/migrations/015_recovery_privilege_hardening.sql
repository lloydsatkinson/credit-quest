-- V2.0d production privilege hardening.
-- Supabase production default table grants can include privileges beyond DML.
-- Enforce the intended trust boundary explicitly: hidden recovery tables are
-- service-role-only; owner-readable tables expose SELECT only to authenticated.

revoke all on public.decline_partners from anon, authenticated;
revoke all on public.decline_partner_credentials from anon, authenticated;
revoke all on public.decline_intake_sessions from anon, authenticated;
revoke all on public.return_contracts from anon, authenticated;

revoke all on public.decline_recovery_journeys from anon, authenticated;
revoke all on public.support_needs from anon, authenticated;
revoke all on public.return_attempts from anon, authenticated;

grant select on public.decline_recovery_journeys to authenticated;
grant select on public.support_needs to authenticated;
grant select on public.return_attempts to authenticated;
