import { useState, useEffect, useRef } from 'react'
import { registerToastHost } from '../lib/toast'

export function Toast() {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    registerToastHost((msg) => {
      setMessage(msg)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setMessage(null), 3000)
    })
    return () => {
      registerToastHost(null)
      clearTimeout(timer.current)
    }
  }, [])

  if (!message) return null

  return (
    <div
      role="status"
      className="fixed top-3 left-4 right-4 max-w-lg mx-auto z-[60] bg-[#1a2530] text-white text-sm rounded-[10px] px-4 py-2.5 shadow-lg"
    >
      {message}
    </div>
  )
}
