-- Credit Quest V2.3 lender decline recovery policy store.
-- Additive, private and dark-first. No live route or feature flag is enabled here.

create table public.canonical_decline_reasons (
  id uuid primary key default gen_random_uuid(),
  canonical_code text not null,
  risk_family text not null,
  default_treatment text not null,
  solveability text not null,
  restricted boolean not null default false,
  infer_root_cause boolean not null default true,
  alternative_credit_permitted_by_default boolean not null default false,
  customer_language_key text not null,
  version integer not null default 1 check (version >= 1),
  lifecycle text not null default 'published'
    check (lifecycle in ('draft','tested','published','retired')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (canonical_code, version)
);

create table public.partner_decline_mappings (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.decline_partners(id) on delete restrict,
  product_category text not null
    check (product_category in ('credit_card','loan','overdraft','mortgage','other')),
  external_code text not null,
  canonical_code text not null,
  parameters jsonb not null default '{}'::jsonb,
  lender_wording text,
  version integer not null check (version >= 1),
  lifecycle text not null default 'draft'
    check (lifecycle in ('draft','tested','published','retired')),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint partner_decline_mapping_effective_check
    check (effective_to is null or effective_to > effective_from),
  unique (partner_id, product_category, external_code, version)
);

create table public.recovery_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  canonical_code text,
  treatment_class text not null
    check (treatment_class in (
      'fix','build','stabilise','create_headroom','wait_and_rebuild',
      'longer_term_recovery','find_a_better_fit','needs_evidence','restricted'
    )),
  solveability text not null
    check (solveability in (
      'fix_now','build_evidence','stabilise_first','time_bound',
      'structural_long_horizon','product_routeable','unknown_or_unmapped','restricted'
    )),
  severity text not null check (severity in ('low','medium','high','structural')),
  recovery_horizon text not null
    check (recovery_horizon in ('immediate','short','medium','long','structural_indeterminate')),
  customer_headline text not null,
  customer_explanation text not null,
  step_ordering_policy text not null default 'phase_then_priority',
  version integer not null check (version >= 1),
  lifecycle text not null default 'draft'
    check (lifecycle in ('draft','tested','published','retired')),
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_key, version)
);

create table public.recovery_template_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.recovery_templates(id) on delete cascade,
  step_order integer not null check (step_order >= 1),
  step_type text not null
    check (step_type in ('action','education','wait','evidence','correction','reassessment')),
  phase text not null check (phase in ('now','next','then','later')),
  priority integer not null default 100 check (priority >= 0),
  customer_wording text not null,
  mission_slug text,
  completion_evidence jsonb,
  entry_condition jsonb,
  exit_condition jsonb,
  condition_schema_version integer not null default 1 check (condition_schema_version = 1),
  min_wait_days integer check (min_wait_days is null or min_wait_days >= 0),
  blocking boolean not null default false,
  requirement_status text not null default 'recommended'
    check (requirement_status in ('required','recommended','informational')),
  version integer not null default 1 check (version >= 1),
  lifecycle text not null default 'draft'
    check (lifecycle in ('draft','tested','published','retired')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (template_id, step_order, version)
);

create table public.reassessment_rules (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.decline_partners(id) on delete restrict,
  product_category text not null
    check (product_category in ('credit_card','loan','overdraft','mortgage','other')),
  canonical_code text not null,
  condition_ast jsonb not null,
  condition_schema_version integer not null default 1 check (condition_schema_version = 1),
  version integer not null check (version >= 1),
  lifecycle text not null default 'draft'
    check (lifecycle in ('draft','tested','published','retired')),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint reassessment_rule_effective_check
    check (effective_to is null or effective_to > effective_from),
  unique (partner_id, product_category, canonical_code, version)
);

create table public.alternative_route_policies (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.decline_partners(id) on delete restrict,
  product_category text not null
    check (product_category in ('credit_card','loan','overdraft','mortgage','other')),
  canonical_code text not null,
  source_product_key text,
  destination_product_key text not null,
  return_contract_id uuid references public.return_contracts(id) on delete set null,
  required_evidence jsonb,
  condition_ast jsonb,
  condition_schema_version integer not null default 1 check (condition_schema_version = 1),
  min_wait_days integer check (min_wait_days is null or min_wait_days >= 0),
  route_priority integer not null default 100 check (route_priority >= 0),
  version integer not null check (version >= 1),
  lifecycle text not null default 'draft'
    check (lifecycle in ('draft','tested','published','retired')),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint alternative_route_policy_effective_check
    check (effective_to is null or effective_to > effective_from),
  unique (partner_id, product_category, canonical_code, destination_product_key, version)
);

create index partner_decline_mappings_lookup_idx
  on public.partner_decline_mappings(partner_id, product_category, external_code, lifecycle, effective_from);
create index reassessment_rules_lookup_idx
  on public.reassessment_rules(partner_id, product_category, canonical_code, lifecycle, effective_from);
create index alternative_route_policies_lookup_idx
  on public.alternative_route_policies(partner_id, product_category, canonical_code, lifecycle, route_priority);
create index recovery_template_steps_order_idx
  on public.recovery_template_steps(template_id, lifecycle, step_order, priority);

alter table public.canonical_decline_reasons enable row level security;
alter table public.partner_decline_mappings enable row level security;
alter table public.recovery_templates enable row level security;
alter table public.recovery_template_steps enable row level security;
alter table public.reassessment_rules enable row level security;
alter table public.alternative_route_policies enable row level security;

revoke all on public.canonical_decline_reasons from anon, authenticated;
revoke all on public.partner_decline_mappings from anon, authenticated;
revoke all on public.recovery_templates from anon, authenticated;
revoke all on public.recovery_template_steps from anon, authenticated;
revoke all on public.reassessment_rules from anon, authenticated;
revoke all on public.alternative_route_policies from anon, authenticated;

grant all on public.canonical_decline_reasons to service_role;
grant all on public.partner_decline_mappings to service_role;
grant all on public.recovery_templates to service_role;
grant all on public.recovery_template_steps to service_role;
grant all on public.reassessment_rules to service_role;
grant all on public.alternative_route_policies to service_role;

insert into public.canonical_decline_reasons(
  canonical_code, risk_family, default_treatment, solveability, restricted,
  infer_root_cause, alternative_credit_permitted_by_default, customer_language_key,
  lifecycle, published_at
) values
  ('CCJ_RECENT','public_adverse','wait_and_rebuild','time_bound',false,true,false,'recent_adverse','published',now()),
  ('CCJ_ACTIVE_UNSATISFIED','public_adverse','longer_term_recovery','structural_long_horizon',false,true,false,'longer_term','published',now()),
  ('DEFAULT_RECENT','public_adverse','wait_and_rebuild','time_bound',false,true,false,'recent_adverse','published',now()),
  ('CAIS_8_9_RECENT','public_adverse','wait_and_rebuild','time_bound',false,true,false,'recent_adverse','published',now()),
  ('MORTGAGE_DEFAULT','public_adverse','longer_term_recovery','structural_long_horizon',false,true,false,'longer_term','published',now()),
  ('MORTGAGE_ARREARS_MATERIAL','public_adverse','stabilise','stabilise_first',false,true,false,'stabilise','published',now()),
  ('ACTIVE_IVA','public_adverse','longer_term_recovery','structural_long_horizon',false,true,false,'longer_term','published',now()),
  ('ACTIVE_BANKRUPTCY','public_adverse','longer_term_recovery','structural_long_horizon',false,true,false,'longer_term','published',now()),
  ('RECENT_BANKRUPTCY','public_adverse','wait_and_rebuild','time_bound',false,true,false,'recent_adverse','published',now()),
  ('ACTIVE_DRO','public_adverse','longer_term_recovery','structural_long_horizon',false,true,false,'longer_term','published',now()),
  ('RECENT_INSOLVENCY','public_adverse','wait_and_rebuild','time_bound',false,true,false,'recent_adverse','published',now()),
  ('ACTIVE_DMP','public_adverse','longer_term_recovery','structural_long_horizon',false,true,false,'longer_term','published',now()),
  ('ARRANGEMENT_TO_PAY_ACTIVE','public_adverse','longer_term_recovery','structural_long_horizon',false,true,false,'longer_term','published',now()),
  ('ACTIVE_PROTECTED_TRUST_DEED','public_adverse','longer_term_recovery','structural_long_horizon',false,true,false,'longer_term','published',now()),
  ('RECENT_PROTECTED_TRUST_DEED','public_adverse','wait_and_rebuild','time_bound',false,true,false,'recent_adverse','published',now()),
  ('ACTIVE_SEQUESTRATION','public_adverse','longer_term_recovery','structural_long_horizon',false,true,false,'longer_term','published',now()),
  ('RECENT_SEQUESTRATION','public_adverse','wait_and_rebuild','time_bound',false,true,false,'recent_adverse','published',now()),
  ('ACTIVE_MINIMAL_ASSET_PROCESS','public_adverse','longer_term_recovery','structural_long_horizon',false,true,false,'longer_term','published',now()),
  ('EARLY_DELINQUENCY','delinquency','stabilise','stabilise_first',false,true,false,'stabilise','published',now()),
  ('ACTIVE_ARREARS','delinquency','stabilise','stabilise_first',false,true,false,'stabilise','published',now()),
  ('MISSED_PAYMENT_RECENT','delinquency','wait_and_rebuild','time_bound',false,true,false,'recent_adverse','published',now()),
  ('CAIS_3_6_RECENT','delinquency','stabilise','stabilise_first',false,true,false,'stabilise','published',now()),
  ('DETERIORATING_EXTERNAL_PERFORMANCE','delinquency','stabilise','stabilise_first',false,true,false,'stabilise','published',now()),
  ('INTERNAL_ARREARS','delinquency','stabilise','stabilise_first',false,true,false,'stabilise','published',now()),
  ('RECENT_STL_ACTIVITY','credit_seeking','wait_and_rebuild','time_bound',false,true,false,'needs_time','published',now()),
  ('MULTIPLE_STL_RECENT','credit_seeking','wait_and_rebuild','time_bound',false,true,false,'needs_time','published',now()),
  ('HIGH_COST_CREDIT_RECENT','credit_seeking','wait_and_rebuild','time_bound',false,true,false,'needs_time','published',now()),
  ('EXCESSIVE_RECENT_SEARCHES','credit_seeking','wait_and_rebuild','time_bound',false,true,false,'needs_time','published',now()),
  ('NEW_ACCOUNT_VELOCITY','credit_seeking','wait_and_rebuild','time_bound',false,true,false,'needs_time','published',now()),
  ('MULTIPLE_ACCOUNTS_OPENED_RECENTLY','credit_seeking','wait_and_rebuild','time_bound',false,true,false,'needs_time','published',now()),
  ('RECENT_APPLICATION_COOLDOWN','credit_seeking','wait_and_rebuild','time_bound',false,true,false,'needs_time','published',now()),
  ('DSR_HIGH','affordability','create_headroom','stabilise_first',false,true,false,'create_headroom','published',now()),
  ('NEGATIVE_DISPOSABLE_INCOME','affordability','create_headroom','stabilise_first',false,true,false,'create_headroom','published',now()),
  ('LOW_DISPOSABLE_INCOME','affordability','create_headroom','stabilise_first',false,true,false,'create_headroom','published',now()),
  ('ESSENTIAL_EXPENDITURE_FAILURE','affordability','create_headroom','stabilise_first',false,true,false,'create_headroom','published',now()),
  ('HIGH_TOTAL_COMMITMENTS','affordability','create_headroom','stabilise_first',false,true,false,'create_headroom','published',now()),
  ('OPEN_BANKING_AFFORDABILITY_FAIL','affordability','create_headroom','stabilise_first',false,true,false,'create_headroom','published',now()),
  ('INCOME_INSUFFICIENT_FOR_REQUEST','affordability','create_headroom','stabilise_first',false,true,false,'create_headroom','published',now()),
  ('INCOME_UNVERIFIED','affordability','fix','fix_now',false,true,false,'data_check','published',now()),
  ('INCOME_MISMATCH','affordability','fix','fix_now',false,true,false,'data_check','published',now()),
  ('INCOME_INSTABILITY','affordability','create_headroom','stabilise_first',false,true,false,'create_headroom','published',now()),
  ('EMPLOYMENT_INSTABILITY','affordability','create_headroom','stabilise_first',false,true,false,'create_headroom','published',now()),
  ('UNSECURED_DEBT_HIGH','indebtedness','create_headroom','stabilise_first',false,true,false,'create_headroom','published',now()),
  ('AGGREGATE_EXPOSURE_HIGH','indebtedness','create_headroom','stabilise_first',false,true,false,'create_headroom','published',now()),
  ('UTILISATION_HIGH','indebtedness','stabilise','stabilise_first',false,true,false,'stabilise','published',now()),
  ('REVOLVING_BALANCE_HIGH','indebtedness','stabilise','stabilise_first',false,true,false,'stabilise','published',now()),
  ('PERSISTENT_OVERDRAFT_USE','indebtedness','stabilise','stabilise_first',false,true,false,'stabilise','published',now()),
  ('OVERLIMIT_BEHAVIOUR','indebtedness','stabilise','stabilise_first',false,true,false,'stabilise','published',now()),
  ('CASH_ADVANCE_BEHAVIOUR','indebtedness','stabilise','stabilise_first',false,true,false,'stabilise','published',now()),
  ('EXISTING_CUSTOMER_EXPOSURE_LIMIT','indebtedness','create_headroom','stabilise_first',false,true,false,'create_headroom','published',now()),
  ('THIN_FILE','file_depth','build','build_evidence',false,true,false,'build_evidence','published',now()),
  ('NO_HIT_FILE','file_depth','build','build_evidence',false,true,false,'build_evidence','published',now()),
  ('INSUFFICIENT_CREDIT_HISTORY','file_depth','build','build_evidence',false,true,false,'build_evidence','published',now()),
  ('LIMITED_UK_FOOTPRINT','file_depth','build','build_evidence',false,true,false,'build_evidence','published',now()),
  ('NEW_TO_UK_LIMITED_HISTORY','file_depth','build','build_evidence',false,true,false,'build_evidence','published',now()),
  ('INSUFFICIENT_ESTABLISHED_ACCOUNTS','file_depth','build','build_evidence',false,true,false,'build_evidence','published',now()),
  ('CAIS_DUPLICATE','data_integrity','fix','fix_now',false,true,false,'data_check','published',now()),
  ('NOC_DATA_ISSUE','data_integrity','fix','fix_now',false,true,false,'data_check','published',now()),
  ('SPECIAL_INSTRUCTION_REVIEW','data_integrity','fix','fix_now',false,true,false,'data_check','published',now()),
  ('BUREAU_DATA_DISCREPANCY','data_integrity','fix','fix_now',false,true,false,'data_check','published',now()),
  ('ADDRESS_FILE_MISMATCH','data_integrity','fix','fix_now',false,true,false,'data_check','published',now()),
  ('IDENTITY_FILE_MISMATCH','data_integrity','fix','fix_now',false,true,false,'data_check','published',now()),
  ('ELECTORAL_ROLL_EVIDENCE_GAP','data_integrity','fix','fix_now',false,true,false,'data_check','published',now()),
  ('CII_EXCLUSION_OR_FILE_SUPPRESSION','data_integrity','fix','fix_now',false,true,false,'data_check','published',now()),
  ('PREVIOUS_INTERNAL_DEFAULT','internal_performance','wait_and_rebuild','time_bound',false,true,false,'needs_time','published',now()),
  ('PREVIOUS_WRITE_OFF','internal_performance','longer_term_recovery','structural_long_horizon',false,true,false,'longer_term','published',now()),
  ('INTERNAL_DELINQUENCY_HISTORY','internal_performance','wait_and_rebuild','time_bound',false,true,false,'needs_time','published',now()),
  ('PRIOR_ACCOUNT_TERMINATION','internal_performance','wait_and_rebuild','time_bound',false,true,false,'needs_time','published',now()),
  ('INTERNAL_RISK_POLICY_HISTORY','internal_performance','needs_evidence','unknown_or_unmapped',false,false,false,'need_more_information','published',now()),
  ('REQUESTED_LIMIT_TOO_HIGH','product_fit','find_a_better_fit','product_routeable',false,true,true,'better_fit','published',now()),
  ('REQUESTED_AMOUNT_TOO_HIGH','product_fit','find_a_better_fit','product_routeable',false,true,true,'better_fit','published',now()),
  ('TERM_MISMATCH','product_fit','find_a_better_fit','product_routeable',false,true,true,'better_fit','published',now()),
  ('PRODUCT_LIMIT_MISMATCH','product_fit','find_a_better_fit','product_routeable',false,true,true,'better_fit','published',now()),
  ('MINIMUM_LIMIT_NOT_MET','product_fit','find_a_better_fit','product_routeable',false,true,true,'better_fit','published',now()),
  ('TOTAL_EXPOSURE_PRODUCT_LIMIT','product_fit','find_a_better_fit','product_routeable',false,true,true,'better_fit','published',now()),
  ('PRODUCT_POLICY_MISMATCH','product_fit','find_a_better_fit','product_routeable',false,true,true,'better_fit','published',now()),
  ('LENDER_POLICY_EXCLUSION','product_fit','needs_evidence','unknown_or_unmapped',false,false,false,'need_more_information','published',now()),
  ('SCORE_CUTOFF','policy_or_score','needs_evidence','unknown_or_unmapped',false,false,false,'need_more_information','published',now()),
  ('CREDIT_RISK_SCORE_CUTOFF','policy_or_score','needs_evidence','unknown_or_unmapped',false,false,false,'need_more_information','published',now()),
  ('AFFORDABILITY_SCORE_CUTOFF','policy_or_score','needs_evidence','unknown_or_unmapped',false,false,false,'need_more_information','published',now()),
  ('POLICY_SCORE_CUTOFF','policy_or_score','needs_evidence','unknown_or_unmapped',false,false,false,'need_more_information','published',now()),
  ('GENERIC_CREDIT_POLICY_DECLINE','policy_or_score','needs_evidence','unknown_or_unmapped',false,false,false,'need_more_information','published',now()),
  ('FRAUD_SECURITY_DECISION','restricted','restricted','restricted',true,false,false,'restricted_decision','published',now()),
  ('AML_RESTRICTED_DECISION','restricted','restricted','restricted',true,false,false,'restricted_decision','published',now()),
  ('SANCTIONS_RESTRICTED_DECISION','restricted','restricted','restricted',true,false,false,'restricted_decision','published',now()),
  ('KYC_RESTRICTED_DECISION','restricted','restricted','restricted',true,false,false,'restricted_decision','published',now()),
  ('OTHER_SECURITY_RESTRICTED_DECISION','restricted','restricted','restricted',true,false,false,'restricted_decision','published',now());

create or replace function public.reject_published_recovery_policy_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.lifecycle = 'published' then
    raise exception 'published_recovery_policy_is_immutable' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger canonical_decline_reasons_immutable
before update or delete on public.canonical_decline_reasons
for each row execute function public.reject_published_recovery_policy_mutation();
create trigger partner_decline_mappings_immutable
before update or delete on public.partner_decline_mappings
for each row execute function public.reject_published_recovery_policy_mutation();
create trigger recovery_templates_immutable
before update or delete on public.recovery_templates
for each row execute function public.reject_published_recovery_policy_mutation();
create trigger recovery_template_steps_immutable
before update or delete on public.recovery_template_steps
for each row execute function public.reject_published_recovery_policy_mutation();
create trigger reassessment_rules_immutable
before update or delete on public.reassessment_rules
for each row execute function public.reject_published_recovery_policy_mutation();
create trigger alternative_route_policies_immutable
before update or delete on public.alternative_route_policies
for each row execute function public.reject_published_recovery_policy_mutation();

create or replace function public.admin_publish_recovery_policy_version(
  p_admin_user_id uuid,
  p_draft_id uuid
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
  set lifecycle = 'published', published_at = coalesce(published_at, now())
  where id = p_draft_id and lifecycle = 'tested'
  returning 'mapping', version into v_kind, v_version;

  if v_kind is null then
    update public.recovery_templates
    set lifecycle = 'published', published_at = coalesce(published_at, now())
    where id = p_draft_id and lifecycle = 'tested'
    returning 'template', version into v_kind, v_version;

    if v_kind is not null then
      update public.recovery_template_steps
      set lifecycle = 'published', published_at = coalesce(published_at, now())
      where template_id = p_draft_id and lifecycle = 'tested';
    end if;
  end if;

  if v_kind is null then
    update public.reassessment_rules
    set lifecycle = 'published', published_at = coalesce(published_at, now())
    where id = p_draft_id and lifecycle = 'tested'
    returning 'reassessment_rule', version into v_kind, v_version;
  end if;

  if v_kind is null then
    update public.alternative_route_policies
    set lifecycle = 'published', published_at = coalesce(published_at, now())
    where id = p_draft_id and lifecycle = 'tested'
    returning 'alternative_route_policy', version into v_kind, v_version;
  end if;

  if v_kind is null then
    raise exception 'tested_recovery_policy_version_not_found' using errcode = 'P0002';
  end if;

  insert into public.admin_audit_log(admin_user_id, action, entity_type, entity_id, metadata)
  values (
    p_admin_user_id,
    'publish',
    'recovery_policy',
    p_draft_id,
    jsonb_build_object('kind', v_kind, 'version', v_version)
  );

  return jsonb_build_object('kind', v_kind, 'id', p_draft_id, 'version', v_version);
end;
$$;

revoke all on function public.admin_publish_recovery_policy_version(uuid,uuid) from public, anon, authenticated;
grant execute on function public.admin_publish_recovery_policy_version(uuid,uuid) to service_role;
