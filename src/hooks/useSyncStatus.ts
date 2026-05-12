import { useState, useEffect } from 'react'

export type SyncStatus = 'synced' | 'syncing' | 'offline'

export function useSyncStatus(): SyncStatus {
  const [online, setOnline] = useState(navigator.onLine)
  const [justCameOnline, setJustCameOnline] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const handleOnline = () => {
      setOnline(true)
      setJustCameOnline(true)
      timer = setTimeout(() => setJustCameOnline(false), 2000)
    }
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearTimeout(timer)
    }
  }, [])

  if (!online) return 'offline'
  if (justCameOnline) return 'syncing'
  return 'synced'
}
