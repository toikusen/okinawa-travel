import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { LoginPage } from './pages/LoginPage'
import { TimelinePage } from './pages/TimelinePage'
import { TripListPage } from './pages/TripListPage'
import { JoinPage } from './pages/JoinPage'
import { SettingsPage } from './pages/SettingsPage'

const PENDING_JOIN_KEY = 'pendingJoinTripId'

function PendingJoinRedirect() {
  const navigate = useNavigate()
  useEffect(() => {
    const pendingTripId = sessionStorage.getItem(PENDING_JOIN_KEY)
    if (pendingTripId) {
      sessionStorage.removeItem(PENDING_JOIN_KEY)
      navigate(`/join/${pendingTripId}`, { replace: true })
    }
  }, [navigate])
  return null
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8]">
        <div className="text-[#8fa0b0] text-sm">載入中...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/join/:tripId" element={<JoinPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    )
  }

  return (
    <>
      <PendingJoinRedirect />
      <Routes>
        <Route path="/" element={<TripListPage />} />
        <Route path="/trips/:tripId" element={<TimelinePage />} />
        <Route path="/join/:tripId" element={<JoinPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
