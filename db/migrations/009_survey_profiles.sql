-- One private survey profile per account. Run after 006_users.sql.
create table if not exists user_survey_profiles (
  user_id bigint primary key references users(id) on delete cascade,
  status text not null check (status in ('skipped', 'completed')),
  answers jsonb,
  completed_at timestamptz,
  skipped_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint survey_profile_state check (
    (status = 'skipped' and answers is null and completed_at is null and skipped_at is not null)
    or
    (status = 'completed' and answers is not null and completed_at is not null)
  ),
  constraint survey_answers_object check (
    answers is null or (jsonb_typeof(answers) = 'object'
      and answers @> '{"survey_version": 2}'::jsonb)
  )
);
