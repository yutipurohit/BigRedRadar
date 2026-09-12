CREATE TABLE events(
    id bigint generated always as identity primary key,
    org_id bigint not null references organizations(id) on delete cascade,
    source_id bigint not null references sources(id) on delete cascade,
    external_id text not null,
    raw_item_id bigint references raw_items(id) on delete set null,    
    title text not null,
    description text not null default '',
    starts_at timestamptz not null,
    ends_at timestamptz,
    all_day boolean not null default false,
    timezone text not null default 'America/New_York',
    location text,
    url text,
    image_url text,
    status text not null default 'scheduled' check (status in ('scheduled', 'cancelled', 'moved')),
    first_seen_at timestamptz not null default now(),
    last_seen_at  timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (source_id, external_id)
);

create index on events (starts_at);
create index on events (org_id, starts_at);
