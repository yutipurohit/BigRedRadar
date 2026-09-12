create table organizations (
  id               bigint generated always as identity primary key,
  slug             text not null unique,
  name             text not null,
  description      text,
  category         text,
  website_url      text,
  instagram_handle text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);


CREATE TABLE sources(
    id bigint generated always as identity primary key,
    org_id bigint not null references organizations(id) on delete cascade,
    kind text not null check (kind in('localist', 'ics', 'website', 'instagram')),
    url text not null,
    config jsonb not null default '{}',
    is_enabled boolean not null default true,
    last_fetched_at timestamptz,
    last_status text,
    etag text,
    last_modified text,
    created_at timestamptz not null default now(),
    unique(org_id, url)
);

CREATE TABLE raw_items(
    id bigint generated always as identity primary key,
    source_id bigint not null references sources(id) on delete cascade,
    external_id text,
    payload text not null,
    content_hash text not null,
    fetched_at timestamptz not null default now(),
    unique nulls not distinct (source_id, external_id, content_hash)
);
