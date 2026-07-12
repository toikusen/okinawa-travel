import { useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTrip } from '../hooks/useTrip'
import { MembersSection } from '../components/MembersSection'
import { TripNav } from '../components/TripNav'

export function MembersPage() {
  const { user } = useAuth()
  const { tripId } = useParams<{ tripId: string }>()
  const { trip, loading } = useTrip(tripId ?? null)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8]">
        <p className="text-sm text-[#52707f]">載入中...</p>
      </div>
    )
  }

  if (!trip) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col max-w-lg mx-auto">
      <header className="bg-white border-b border-[#e8edf2] px-4 py-3 sticky top-0 z-10">
        <h1 className="text-base font-bold text-[#1a2530]">旅伴</h1>
      </header>

      <main className="flex-1 px-4 py-4">
        <MembersSection trip={trip} currentEmail={user?.email} />
      </main>

      <TripNav tripId={trip.id} active="members" />
    </div>
  )
}
