-- Harden Action Layer relationships so referenced account/mission rows must
-- belong to the same user as the referencing row. RLS protects row access;
-- these composite foreign keys also protect referential integrity from direct
-- authenticated writes that know or guess another row's UUID.

create unique index if not exists user_accounts_id_user_unique
  on public.user_accounts(id, user_id);

create unique index if not exists user_missions_id_user_unique
  on public.user_missions(id, user_id);

-- Starting an action is idempotent at the database boundary. A mission may
-- have historical attempts, but only one open/resumable attempt at a time.
create unique index if not exists action_attempts_one_open_per_mission
  on public.action_attempts(mission_instance_id)
  where status in ('started', 'returned', 'submitted');

alter table public.user_missions
  drop constraint if exists user_missions_subject_id_fkey;

alter table public.user_missions
  drop constraint if exists user_missions_subject_owner_fkey;

alter table public.user_missions
  add constraint user_missions_subject_owner_fkey
  foreign key (subject_id, user_id)
  references public.user_accounts(id, user_id)
  on delete cascade;

alter table public.action_attempts
  drop constraint if exists action_attempts_mission_instance_id_fkey;

alter table public.action_attempts
  drop constraint if exists action_attempts_mission_owner_fkey;

alter table public.action_attempts
  add constraint action_attempts_mission_owner_fkey
  foreign key (mission_instance_id, user_id)
  references public.user_missions(id, user_id)
  on delete cascade;

alter table public.action_attempts
  drop constraint if exists action_attempts_account_id_fkey;

alter table public.action_attempts
  drop constraint if exists action_attempts_account_owner_fkey;

alter table public.action_attempts
  add constraint action_attempts_account_owner_fkey
  foreign key (account_id, user_id)
  references public.user_accounts(id, user_id)
  on delete cascade;
