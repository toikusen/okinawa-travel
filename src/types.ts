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
}

export interface Day {
  id: string
  date: string       // 'YYYY-MM-DD'
  label: string
  sort_order: number
}

export interface Trip {
  id: string
  name: string
  members: string[]  // email addresses
  start_date: string // 'YYYY-MM-DD'
  end_date: string   // 'YYYY-MM-DD'
}
