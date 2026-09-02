insert into public.feature_flags(flag_key, enabled, description)
values (
  'commercial_sandbox_enabled', false,
  'Allow Credit Quest sandbox referral simulations after all hard gates.'
)
on conflict (flag_key) do update set
  enabled = false,
  description = excluded.description,
  updated_at = now();

create or replace function public.admin_set_feature_flag(
  p_admin_user_id uuid,
  p_flag_key text,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_credit_quest_admin(p_admin_user_id);

  if p_flag_key not in ('email_reminders_enabled','commercial_gateway_enabled','commercial_sandbox_enabled') then
    raise exception 'Feature flag is not admin-editable';
  end if;

  update public.feature_flags
  set enabled = p_enabled, updated_at = now()
  where flag_key = p_flag_key;

  if not found then
    raise exception 'Feature flag not found';
  end if;

  insert into public.admin_audit_log(admin_user_id, action, entity_type, metadata)
  values (
    p_admin_user_id,
    'set_feature_flag',
    'feature_flag',
    jsonb_build_object('flag_key', p_flag_key, 'enabled', p_enabled)
  );
end;
$$;

revoke all on function public.admin_set_feature_flag(uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.admin_set_feature_flag(uuid,text,boolean) to service_role;
