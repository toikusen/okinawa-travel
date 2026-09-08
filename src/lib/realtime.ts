export type ChannelStatus = 'connecting' | 'connected' | 'error'

// ponytail: one global status for all channels — they share a socket, so a
// per-channel breakdown would tell the user nothing extra.
let current: ChannelStatus = 'connecting'
const listeners = new Set<(s: ChannelStatus) => void>()

/** Map a Supabase channel subscribe() status onto our three states. */
export function reportChannelStatus(supabaseStatus: string): void {
  const next: ChannelStatus = supabaseStatus === 'SUBSCRIBED' ? 'connected' : 'error'
  if (next === current) return
  current = next
  listeners.forEach((l) => l(next))
}

export function getChannelStatus(): ChannelStatus {
  return current
}

export function onChannelStatus(listener: (s: ChannelStatus) => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
