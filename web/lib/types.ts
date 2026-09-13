export type Org = {
  slug: string
  name: string
  category: string | null
  is_student_org: boolean
  upcoming: number
}

export type EventItem = {
  id: number
  title: string
  starts_at: string
  ends_at: string | null
  all_day: boolean
  time_tba: boolean
  location: string | null
  url: string | null
  image_url: string | null
  description: string | null
  org_name: string
  org_slug: string
  org_category: string | null
}

export type Me = {
  id: number
  email: string
  name: string | null
  picture_url: string | null
  is_cornell: boolean
}

export type Session = {
  googleClientId: string
  user: Me | null
  follows: string[]
}
