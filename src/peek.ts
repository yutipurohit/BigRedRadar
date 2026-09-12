const url = 'https://events.cornell.edu/api/2/events?days=7&pp=20'
const res = await fetch(url)
const data = await res.json()

const results = []

for (const item of data.events) {
  const ev = item.event

  for (const instBox of ev.event_instances) {
    const inst = instBox.event_instance

    results.push({
      externalId: String(inst.id),
      title: ev.title,
      startsAt: inst.start,
      allDay: inst.all_day,
    })
  }
}

console.log(results)
console.log('total:', results.length)