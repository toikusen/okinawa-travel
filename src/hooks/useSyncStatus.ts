import { useState, useEffect } from 'react'
import { getChannelStatus, onChannelStatus, type ChannelStatus } from '../lib/realtime'

export type SyncStatus = ChannelStatus | 'offline'

export function useSyncStatus(): SyncStatus {
  const [online, setOnline] = useState(navigator.onLine)
  const [channel, setChannel] = useState<ChannelStatus>(getChannelStatus)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    const off = onChannelStatus(setChannel)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      off()
    }
  }, [])

  return online ? channel : 'offline'
}
