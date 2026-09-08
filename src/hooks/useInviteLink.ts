import { useState } from 'react'

export function useInviteLink(trip: { id: string; name: string }) {
  const [copied, setCopied] = useState(false)
  const inviteUrl = `${window.location.origin}/join/${trip.id}`

  const copy = async () => {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: trip.name, text: `一起來規劃「${trip.name}」`, url: inviteUrl })
        return
      } catch {
        return // user cancelled the share sheet
      }
    }
    await copy()
  }

  return { inviteUrl, copied, share, copy }
}
