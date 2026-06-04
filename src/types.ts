export interface ForkItem {
  person: string
  title: string
  location: string
  notes: string
}

export interface TripEvent {
  id: string
  type: 'shared' | 'fork'
  title: string
  time_start: string
  time_end: string
  location: string
  notes: string
  sort_order: number
  fork_items?: [ForkItem, ForkItem]
  image_url?: string | null
  link_url?: string | null
}

export interface Day {
  id: string
  date: string       // 'YYYY-MM-DD'
  label: string
  sort_order: number
}

export interface TripMember {
  email: string
  display_name: string
  avatar_url: string
}

export interface Trip {
  id: string
  name: string
  owner_email: string
  members: TripMember[]
  start_date: string
  end_date: string
}
