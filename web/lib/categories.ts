export const CATEGORIES: [string, string][] = [
  ['project-team', 'Project Teams'],
  ['academic', 'Academic & Research'],
  ['pre-professional', 'Pre-Professional'],
  ['cultural', 'Cultural & Identity'],
  ['performing-arts', 'Arts & Performance'],
  ['sports', 'Sports & Fitness'],
  ['gaming', 'Gaming'],
  ['service', 'Service & Advocacy'],
  ['religious', 'Religious & Spiritual'],
  ['political', 'Politics'],
  ['interest', 'Hobbies & Interests'],
  ['media', 'Media'],
  ['greek', 'Greek & Honor Societies'],
  ['campus', 'Campus & Venues'],
  ['residential', 'Residential'],
  ['graduate', 'Graduate & Professional'],
]

export function categoryLabel(key: string | null) {
  if (!key) return null
  return CATEGORIES.find(([k]) => k === key)?.[1] ?? null
}
