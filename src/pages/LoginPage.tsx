import { useAuth } from '../hooks/useAuth'
import { Logo } from '../components/Logo'

export function LoginPage() {
  const { signIn } = useAuth()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-bg px-6">
      <div className="text-center flex flex-col items-center">
        <div className="mb-4"><Logo size={56} /></div>
        <h1 className="text-2xl font-bold text-text-strong">Tabi</h1>
        <p className="text-text-label mt-2 text-sm">和朋友一起排行程，即時同步</p>
      </div>
      <button
        onClick={() => signIn()}
        className="w-full max-w-xs bg-primary text-white rounded-[10px] py-3 px-6 font-semibold text-sm active:opacity-80 transition-opacity"
      >
        Google 帳號登入
      </button>
    </div>
  )
}
