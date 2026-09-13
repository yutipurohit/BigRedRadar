alter table events add column if not exists time_tba boolean not null default false;

update events e
set time_tba = true, updated_at = now()
from organizations o, sources s
where e.org_id = o.id
  and e.source_id = s.id
  and o.category = 'project-team'
  and s.kind = 'website'
  and e.all_day = true;
