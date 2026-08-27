-- Phase B of the Action Layer rollout. Run only after the new app version is
-- live. The additive 003 migration keeps the legacy (user_id, mission_slug)
-- primary key so V2.0a remains compatible during deployment. This migration
-- switches mission identity to the stable instance id and permits one mission
-- slug to exist independently for multiple account subjects.

alter table public.user_missions
  drop constraint if exists user_missions_pkey;

alter table public.user_missions
  add constraint user_missions_pkey primary key (id);

create unique index if not exists user_missions_profile_unique
  on public.user_missions(user_id, mission_slug)
  where subject_type = 'profile';

create unique index if not exists user_missions_account_unique
  on public.user_missions(user_id, mission_slug, subject_id)
  where subject_type = 'account';
