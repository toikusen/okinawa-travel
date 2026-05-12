import { useAuth } from '../hooks/useAuth'

export function LoginPage() {
  const { signIn } = useAuth()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-[#f0f4f8] px-6">
      <div className="text-center">
        <div className="text-5xl mb-4">🌺</div>
        <h1 className="text-2xl font-bold text-[#1a2530]">沖繩旅遊</h1>
        <p className="text-[#5a7a8a] mt-2 text-sm">共享行程，一起出發</p>
      </div>
      <button
        onClick={signIn}
        className="w-full max-w-xs bg-[#0077b6] text-white rounded-[10px] py-3 px-6 font-semibold text-sm active:opacity-80 transition-opacity"
      >
        Google 帳號登入
      </button>
    </div>
  )
}
