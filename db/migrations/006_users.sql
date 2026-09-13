create table if not exists users (
  id bigint generated always as identity primary key,
  google_sub text not null unique,
  email text not null,
  name text,
  picture_url text,
  is_cornell boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists sessions (
  token_hash text primary key,
  user_id bigint not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists sessions_user_idx on sessions (user_id);

create table if not exists subscriptions (
  user_id bigint not null references users(id) on delete cascade,
  org_id bigint not null references organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);

create index if not exists subscriptions_org_idx on subscriptions (org_id);
