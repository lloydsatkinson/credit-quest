-- Credit Quest V2.3 policy retirement hardening.
-- Published policy content remains immutable; only lifecycle published -> retired is permitted.

create or replace function public.reject_published_recovery_policy_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.lifecycle = 'published' then
    if tg_op = 'UPDATE' then
      if new.lifecycle = 'retired'
         and (to_jsonb(new) - 'lifecycle') = (to_jsonb(old) - 'lifecycle') then
        return new;
      end if;
    end if;
    raise exception 'published_recovery_policy_is_immutable' using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.admin_retire_recovery_policy_version(
  p_admin_user_id uuid,
  p_policy_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_version integer;
begin
  perform public.assert_credit_quest_admin(p_admin_user_id);

  update public.partner_decline_mappings
  set lifecycle = 'retired'
  where id = p_policy_id and lifecycle = 'published'
  returning 'mapping', version into v_kind, v_version;

  if v_kind is null then
    update public.recovery_templates
    set lifecycle = 'retired'
    where id = p_policy_id and lifecycle = 'published'
    returning 'template', version into v_kind, v_version;

    if v_kind is not null then
      update public.recovery_template_steps
      set lifecycle = 'retired'
      where template_id = p_policy_id and lifecycle = 'published';
    end if;
  end if;

  if v_kind is null then
    update public.reassessment_rules
    set lifecycle = 'retired'
    where id = p_policy_id and lifecycle = 'published'
    returning 'reassessment_rule', version into v_kind, v_version;
  end if;

  if v_kind is null then
    update public.alternative_route_policies
    set lifecycle = 'retired'
    where id = p_policy_id and lifecycle = 'published'
    returning 'alternative_route_policy', version into v_kind, v_version;
  end if;

  if v_kind is null then
    raise exception 'published_recovery_policy_version_not_found' using errcode = 'P0002';
  end if;

  insert into public.admin_audit_log(admin_user_id, action, entity_type, entity_id, metadata)
  values (
    p_admin_user_id,
    'retire',
    'recovery_policy',
    p_policy_id,
    jsonb_build_object('kind', v_kind, 'version', v_version)
  );

  return jsonb_build_object('kind', v_kind, 'id', p_policy_id, 'version', v_version, 'lifecycle', 'retired');
end;
$$;

revoke all on function public.admin_retire_recovery_policy_version(uuid,uuid) from public, anon, authenticated;
grant execute on function public.admin_retire_recovery_policy_version(uuid,uuid) to service_role;
