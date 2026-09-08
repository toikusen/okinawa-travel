import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { LoginPage } from './pages/LoginPage'
import { TimelinePage } from './pages/TimelinePage'
import { NewTripPage } from './pages/NewTripPage'
import { TripListPage } from './pages/TripListPage'
import { JoinPage } from './pages/JoinPage'
import { SettingsPage } from './pages/SettingsPage'
import { MembersPage } from './pages/MembersPage'
import { Toast } from './components/Toast'

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
        <div className="text-[#52707f] text-sm">載入中...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <>
        <Routes>
          <Route path="/join/:tripId" element={<JoinPage />} />
          <Route path="*" element={<LoginPage />} />
        </Routes>
        <Toast />
      </>
    )
  }

  return (
    <>
      <PendingJoinRedirect />
      <Routes>
        <Route path="/" element={<TripListPage />} />
        <Route path="/trips/new" element={<NewTripPage />} />
        <Route path="/trips/:tripId" element={<TimelinePage />} />
        <Route path="/trips/:tripId/settings" element={<SettingsPage />} />
        <Route path="/trips/:tripId/members" element={<MembersPage />} />
        <Route path="/join/:tripId" element={<JoinPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toast />
    </>
  )
}
