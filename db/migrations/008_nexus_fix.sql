delete from events e
using organizations o, sources s
where e.org_id = o.id
  and e.source_id = s.id
  and o.slug = 'cornell-nexus'
  and s.kind = 'website';

insert into events
  (org_id, source_id, external_id, title, starts_at, all_day, time_tba, location, url)
select
  o.id, s.id, v.external_id, v.title, v.starts_at,
  v.all_day, v.time_tba, v.location, s.url
from (values
  ('cornell-nexus-2026-08-30-info-session-1',
   'Info Session 1',
   (timestamp '2026-08-30 17:00' at time zone 'America/New_York'),
   false, false, 'Bard Hall 140'::text),

  ('cornell-nexus-2026-09-14-info-session-2',
   'Info Session 2',
   (timestamp '2026-09-14 20:00' at time zone 'America/New_York'),
   false, false, 'Location TBD'),

  ('cornell-nexus-2026-09-18-electrical-workshop',
   'Electrical Workshop',
   (timestamp '2026-09-18 17:00' at time zone 'America/New_York'),
   false, false, 'Location TBD'),

  ('cornell-nexus-2026-09-19-mechanical-workshop',
   'Mechanical Workshop',
   (timestamp '2026-09-19 00:00' at time zone 'America/New_York'),
   true, true, 'Upson 225'),

  ('cornell-nexus-2026-09-29-info-session-3',
   'Info Session 3',
   (timestamp '2026-09-29 17:00' at time zone 'America/New_York'),
   false, false, 'Location TBD'),

  ('cornell-nexus-2026-10-08-info-session-4',
   'Info Session 4',
   (timestamp '2026-10-08 17:00' at time zone 'America/New_York'),
   false, false, 'Location TBD'),

  ('cornell-nexus-2026-10-15-undergraduate-applications-due',
   'Undergraduate Applications Due',
   (timestamp '2026-10-15 23:59' at time zone 'America/New_York'),
   false, false, null)
) as v(external_id, title, starts_at, all_day, time_tba, location)
join organizations o on o.slug = 'cornell-nexus'
join sources s on s.org_id = o.id and s.kind = 'website'
on conflict (source_id, external_id) do update set
  title        = excluded.title,
  starts_at    = excluded.starts_at,
  all_day      = excluded.all_day,
  time_tba     = excluded.time_tba,
  location     = excluded.location,
  url          = excluded.url,
  status       = 'scheduled',
  last_seen_at = now(),
  updated_at   = now();
