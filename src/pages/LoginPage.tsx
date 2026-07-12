import { useAuth } from '../hooks/useAuth'
import { Logo } from '../components/Logo'

export function LoginPage() {
  const { signIn } = useAuth()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-[#f0f4f8] px-6">
      <div className="text-center flex flex-col items-center">
        <div className="mb-4"><Logo size={56} /></div>
        <h1 className="text-2xl font-bold text-[#1a2530]">Tabi</h1>
        <p className="text-[#52707f] mt-2 text-sm">和朋友一起排行程，即時同步</p>
      </div>
      <button
        onClick={() => signIn()}
        className="w-full max-w-xs bg-[#0077b6] text-white rounded-[10px] py-3 px-6 font-semibold text-sm active:opacity-80 transition-opacity"
      >
        Google 帳號登入
      </button>
    </div>
  )
}
