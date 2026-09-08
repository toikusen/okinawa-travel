# Tabi 資訊架構重整與正確性修復 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Tabi 從「規劃工具」調成「當天執行工具」，同時修掉會顯示錯誤資訊的缺陷、消除重複的資訊架構、統一互動語言。

**Architecture:** 保持單一時間軸頁為唯一的行程呈現處，在其上方加一個依即時時鐘驅動的「現在」區塊；把每日一條的 realtime 訂閱收斂成整趟一條，讓跨日查詢成為可能；把所有原生對話框換成既有 BottomSheet 語言的元件。不新增頁面，刪掉一個重複頁面。

**Tech Stack:** React 18、TypeScript 5.6、Vite 5、React Router 7、Tailwind CSS 4（`@theme` tokens）、Supabase（Postgres + RLS + Realtime + Storage）、Vitest 2 + Testing Library + jsdom。

**Spec:** `docs/superpowers/specs/2026-09-08-tabi-ia-redesign-design.md`

## Global Constraints

- 既有 93 個測試必須全程維持綠燈。每個 task 結束前跑 `npm test`。
- 只修不刪：不移除任何既有功能。唯一新增功能是地圖導航連結（Task 7）。
- 明確排除：深色模式、離線寫入佇列、花費／訂房紀錄、行程負責人、主揪轉移、fork 一組多人。
- 程式碼、註解、commit message 一律英文；UI 文案一律繁體中文（台灣用語）。
- Commit 格式：Gitmoji + Conventional Commits，例如 `✨ feat(timeline): add now section`。
- 顏色不得引入新色值。Task 17 只做 hex → token 的機械替換。
- **Supabase migration 不得使用 `supabase db push`**（remote migration history 是空的，push 會嘗試重跑全部歷史）。新 migration 用 Management API 單獨套用，指令見 Task 15。
- 測試檔放在 `src/__tests__/` 下，鏡射原始檔路徑（既有慣例）。
- 元件測試 mock hooks 與子元件（見 `src/__tests__/pages/TimelinePage.test.tsx` 的寫法）；`db.ts` 測試用 `// @vitest-environment node` 加 `vi.hoisted` mock supabase client（見 `src/__tests__/lib/db.test.ts`）。

---

## File Structure

**新增**

| 檔案 | 責任 |
|---|---|
| `src/hooks/useNow.ts` | 每分鐘推進一次的時鐘，供「現在」區塊與現在時間線共用 |
| `src/lib/realtime.ts` | 全域 realtime 連線狀態的極簡 store（set / get / subscribe） |
| `src/lib/toast.ts` | 模組層級的 `toast(msg)` 函式與宿主註冊點 |
| `src/components/Toast.tsx` | Toast 宿主，掛在 App 根層一次 |
| `src/components/ConfirmSheet.tsx` | 取代 `window.confirm` / `window.prompt` 的確認 sheet |
| `src/components/NowSection.tsx` | 時間軸頂部的「現在進行中／接下來」區塊 |
| `src/components/InviteCard.tsx` | 只有一位成員時的邀請提示卡 |
| `src/hooks/useInviteLink.ts` | 邀請連結的分享／複製邏輯（從 `MembersSection` 抽出） |
| `supabase/migrations/011_reorder_events_rpc.sql` | 單次交易的排序寫入 RPC |

**刪除**

| 檔案 | 原因 |
|---|---|
| `src/pages/MembersPage.tsx` | 與設定頁的 `MembersSection` 重複 |
| `src/hooks/useEvents.ts` | 被 `useTrip` 的 `eventsByDay` 取代 |

**修改**：`src/App.tsx`、`src/types.ts`、`src/index.css`、`index.html`、`src/lib/db.ts`、`src/lib/dates.ts`、`src/hooks/useTrip.ts`、`src/hooks/useSyncStatus.ts`、`src/hooks/useInstallPrompt.ts`、`src/pages/TimelinePage.tsx`、`src/pages/TripListPage.tsx`、`src/pages/NewTripPage.tsx`、`src/pages/SettingsPage.tsx`、`src/components/DaySection.tsx`、`src/components/EventCard.tsx`、`src/components/ForkCard.tsx`、`src/components/EventSheet.tsx`、`src/components/AccountSheet.tsx`、`src/components/MembersSection.tsx`、`src/components/SyncIndicator.tsx`、`src/components/TripNav.tsx`、`src/components/InstallPrompt.tsx`

---

## Task 1: `useNow` 每分鐘時鐘

**Files:**
- Create: `src/hooks/useNow.ts`
- Test: `src/__tests__/hooks/useNow.test.ts`

**Interfaces:**
- Consumes: 無
- Produces: `useNow(): Date` — 回傳目前時間，每分鐘重新渲染一次呼叫端。
  `hhmm(d: Date): string` — 從 `src/lib/dates.ts` 匯出，把 Date 轉成 `'HH:MM'`。

- [ ] **Step 1: 先寫失敗的測試**

`src/__tests__/hooks/useNow.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNow } from '../../hooks/useNow'

describe('useNow', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('returns the current time on first render', () => {
    vi.setSystemTime(new Date('2026-10-12T09:30:00'))
    const { result } = renderHook(() => useNow())
    expect(result.current.getHours()).toBe(9)
    expect(result.current.getMinutes()).toBe(30)
  })

  it('advances once a minute has passed', () => {
    vi.setSystemTime(new Date('2026-10-12T09:30:00'))
    const { result } = renderHook(() => useNow())
    act(() => {
      vi.setSystemTime(new Date('2026-10-12T09:31:00'))
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current.getMinutes()).toBe(31)
  })

  it('clears its interval on unmount', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval')
    const { unmount } = renderHook(() => useNow())
    unmount()
    expect(clearSpy).toHaveBeenCalled()
  })
})
```

`src/__tests__/lib/dates.test.ts` 尾端追加：

```ts
  it('hhmm zero-pads hours and minutes', () => {
    expect(hhmm(new Date('2026-10-12T09:05:00'))).toBe('09:05')
    expect(hhmm(new Date('2026-10-12T18:45:00'))).toBe('18:45')
  })
```

同時把該檔最上方的 import 改成包含 `hhmm`。

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/__tests__/hooks/useNow.test.ts src/__tests__/lib/dates.test.ts`
Expected: FAIL — `Failed to resolve import "../../hooks/useNow"` 以及 `hhmm is not exported`。

- [ ] **Step 3: 寫最小實作**

`src/hooks/useNow.ts`：

```ts
import { useState, useEffect } from 'react'

/** Current time, re-rendering the caller once a minute. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  return now
}
```

`src/lib/dates.ts` 追加：

```ts
/** Date → 'HH:MM' */
export function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test`
Expected: PASS，測試數從 93 → 97。

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useNow.ts src/lib/dates.ts src/__tests__/hooks/useNow.test.ts src/__tests__/lib/dates.test.ts
git commit -m "✨ feat(time): add useNow minute clock and hhmm formatter"
```

---

## Task 2: `db.ts` 寫入函式回傳結果、清除死參數

**Files:**
- Modify: `src/lib/db.ts:151-156`（`updateTrip`）、`src/lib/db.ts:238-244`（`updateDayLabel`）、`src/lib/db.ts:260-283`（`updateEvent` / `deleteEvent`）、`src/lib/db.ts:246-258`（`subscribeToEvents` 簽章）、`src/lib/db.ts:318-327`（`reorderEvents`）
- Modify: `src/components/DaySection.tsx`、`src/components/EventSheet.tsx`、`src/pages/SettingsPage.tsx`（呼叫端）
- Test: `src/__tests__/lib/db.test.ts`

**Interfaces:**
- Consumes: 無
- Produces:
  - `export type WriteResult = { ok: boolean; error?: string }`（在 `src/lib/db.ts` 定義並匯出）
  - `updateTrip(tripId: string, data: Partial<Pick<Trip,'name'|'start_date'|'end_date'>>): Promise<WriteResult>`
  - `updateDayLabel(dayId: string, label: string): Promise<WriteResult>`
  - `updateEvent(eventId: string, data: Partial<Omit<TripEvent,'id'>>): Promise<WriteResult>`
  - `deleteEvent(eventId: string): Promise<WriteResult>`
  - `reorderEvents(dayId: string, orderedIds: string[]): Promise<WriteResult>`
  - `subscribeToEvents(dayId: string, cb: (e: TripEvent[]) => void): () => void`

- [ ] **Step 1: 先寫失敗的測試**

`src/__tests__/lib/db.test.ts` 的 import 區塊加入 `updateDayLabel`、`updateEvent`、`deleteEvent`，並追加一個 describe：

```ts
describe('write results', () => {
  it('updateTrip reports failure instead of swallowing the error', async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: 'nope' } })
    mockFrom.mockReturnValue({ update: vi.fn(() => ({ eq })) })
    expect(await updateTrip('t1', { name: 'x' })).toEqual({ ok: false, error: 'nope' })
  })

  it('updateTrip reports success', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ update: vi.fn(() => ({ eq })) })
    expect(await updateTrip('t1', { name: 'x' })).toEqual({ ok: true })
  })

  it('updateDayLabel takes only dayId and reports failure', async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: 'boom' } })
    const update = vi.fn(() => ({ eq }))
    mockFrom.mockReturnValue({ update })
    expect(await updateDayLabel('d1', 'Day 1')).toEqual({ ok: false, error: 'boom' })
    expect(update).toHaveBeenCalledWith({ label: 'Day 1' })
    expect(eq).toHaveBeenCalledWith('id', 'd1')
  })

  it('updateEvent takes only eventId and reports success', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ update: vi.fn(() => ({ eq })) })
    expect(await updateEvent('e1', { title: 'x' })).toEqual({ ok: true })
  })

  it('deleteEvent takes only eventId and reports failure', async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: 'denied' } })
    mockFrom.mockReturnValue({ delete: vi.fn(() => ({ eq })) })
    expect(await deleteEvent('e1')).toEqual({ ok: false, error: 'denied' })
  })
})
```

既有的 `reorderEvents` 測試呼叫的是 `reorderEvents(tripId, dayId, ids)`，改成 `reorderEvents(dayId, ids)` 並斷言回傳 `{ ok: true }`。

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/__tests__/lib/db.test.ts`
Expected: FAIL — `updateTrip` 回傳 `undefined` 而非 `{ ok: true }`；`updateDayLabel` 參數數量不符。

- [ ] **Step 3: 寫最小實作**

`src/lib/db.ts`：

```ts
export type WriteResult = { ok: boolean; error?: string }

export async function updateTrip(
  tripId: string,
  data: Partial<Pick<Trip, 'name' | 'start_date' | 'end_date'>>
): Promise<WriteResult> {
  const { error } = await supabase.from('trips').update(data).eq('id', tripId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function updateDayLabel(dayId: string, label: string): Promise<WriteResult> {
  const { error } = await supabase.from('days').update({ label }).eq('id', dayId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function updateEvent(
  eventId: string,
  data: Partial<Omit<TripEvent, 'id'>>
): Promise<WriteResult> {
  const { error } = await supabase.from('events').update(data).eq('id', eventId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function deleteEvent(eventId: string): Promise<WriteResult> {
  const { error } = await supabase.from('events').delete().eq('id', eventId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function reorderEvents(dayId: string, orderedIds: string[]): Promise<WriteResult> {
  const results = await Promise.all(
    orderedIds.map((id, i) =>
      supabase.from('events').update({ sort_order: i }).eq('id', id)
    )
  )
  const failed = results.find(r => r.error)
  return failed?.error ? { ok: false, error: failed.error.message } : { ok: true }
}
```

`subscribeToEvents` 的簽章去掉第一個 `_tripId` 參數（Task 8 會整支刪掉，這裡只先對齊）。

呼叫端更新：
- `DaySection.tsx`：`updateDayLabel(tripId, day.id, labelDraft)` → `updateDayLabel(day.id, labelDraft)`；`reorderEvents(tripId, day.id, ids)` → `reorderEvents(day.id, ids)`；`useEvents(tripId, day.id)` 暫時改成 `useEvents(day.id)`，並同步調整 `src/hooks/useEvents.ts` 與 `subscribeToEvents` 的簽章。
- `EventSheet.tsx`：`updateEvent(tripId, dayId, event!.id, data)` → `updateEvent(event!.id, data)`；`deleteEvent(tripId, dayId, event.id)` → `deleteEvent(event.id)`；`reorderEvents(tripId, dayId, ids)` → `reorderEvents(dayId, ids)`。
- `SettingsPage.tsx` 的 `handleSaveName` 改成：

```ts
  const handleSaveName = async () => {
    if (!tripId || !nameInput.trim() || nameInput.trim() === trip?.name) return
    const result = await updateTrip(tripId, { name: nameInput.trim() })
    if (result.ok) flashSaved('name')
    else window.alert('名稱儲存失敗,請再試一次。')
  }
```

（`window.alert` 在 Task 4 才換掉，這裡先維持既有行為，只修正「失敗也顯示已儲存」。）

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test && npx tsc -b`
Expected: 測試 PASS、TypeScript 無錯誤。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "🐛 fix(db): return write results and drop dead trip/day params"
```

---

## Task 3: Toast 與 ConfirmSheet

**Files:**
- Create: `src/lib/toast.ts`、`src/components/Toast.tsx`、`src/components/ConfirmSheet.tsx`
- Modify: `src/App.tsx`（掛載 `<Toast />`）
- Test: `src/__tests__/components/Toast.test.tsx`、`src/__tests__/components/ConfirmSheet.test.tsx`

**Interfaces:**
- Consumes: `BottomSheet`（`src/components/BottomSheet.tsx`，props：`label`、`onClose`、`backdropTestId`、`panelClassName`、`children`）
- Produces:
  - `toast(message: string): void` — 從 `src/lib/toast.ts` 匯出，隨處可呼叫。
  - `<Toast />` — 無 props，掛在 App 根層一次。
  - `<ConfirmSheet title description confirmLabel onConfirm onCancel destructive? requireTypedText? />`
    - `title: string`、`description?: string`、`confirmLabel: string`
    - `onConfirm: () => void`、`onCancel: () => void`
    - `destructive?: boolean` — 確認鈕轉紅
    - `requireTypedText?: string` — 有值時顯示輸入框，輸入內容需完全相符才能按確認

- [ ] **Step 1: 先寫失敗的測試**

`src/__tests__/components/Toast.test.tsx`：

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { Toast } from '../../components/Toast'
import { toast } from '../../lib/toast'

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('renders nothing until a message is pushed', () => {
    render(<Toast />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows a pushed message', () => {
    render(<Toast />)
    act(() => toast('儲存失敗'))
    expect(screen.getByRole('status')).toHaveTextContent('儲存失敗')
  })

  it('dismisses itself after 3 seconds', () => {
    render(<Toast />)
    act(() => toast('儲存失敗'))
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
```

`src/__tests__/components/ConfirmSheet.test.tsx`：

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmSheet } from '../../components/ConfirmSheet'

describe('ConfirmSheet', () => {
  it('calls onConfirm when the confirm button is pressed', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmSheet title="確定刪除?" confirmLabel="刪除" onConfirm={onConfirm} onCancel={vi.fn()} />
    )
    await userEvent.click(screen.getByRole('button', { name: '刪除' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when the cancel button is pressed', async () => {
    const onCancel = vi.fn()
    render(
      <ConfirmSheet title="確定刪除?" confirmLabel="刪除" onConfirm={vi.fn()} onCancel={onCancel} />
    )
    await userEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('keeps confirm disabled until the required text matches', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmSheet
        title="刪除旅程"
        confirmLabel="刪除"
        requireTypedText="沖繩四日遊"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )
    const confirm = screen.getByRole('button', { name: '刪除' })
    expect(confirm).toBeDisabled()

    await userEvent.type(screen.getByLabelText('請輸入旅程名稱以確認'), '沖繩')
    expect(confirm).toBeDisabled()

    await userEvent.type(screen.getByLabelText('請輸入旅程名稱以確認'), '四日遊')
    expect(confirm).toBeEnabled()
    await userEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/__tests__/components/Toast.test.tsx src/__tests__/components/ConfirmSheet.test.tsx`
Expected: FAIL — 兩個模組都無法解析。

- [ ] **Step 3: 寫最小實作**

`src/lib/toast.ts`：

```ts
// ponytail: module-level singleton, one Toast host mounted at the app root.
// Swap for a context provider only if a second, independently-scoped host appears.
type Push = (message: string) => void

let push: Push | null = null

export function registerToastHost(fn: Push | null): void {
  push = fn
}

export function toast(message: string): void {
  push?.(message)
}
```

`src/components/Toast.tsx`：

```tsx
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
```

`src/components/ConfirmSheet.tsx`：

```tsx
import { useState } from 'react'
import { BottomSheet } from './BottomSheet'

interface Props {
  title: string
  description?: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  destructive?: boolean
  /** When set, the confirm button unlocks only once the user types this exactly. */
  requireTypedText?: string
}

export function ConfirmSheet({
  title, description, confirmLabel, onConfirm, onCancel, destructive, requireTypedText,
}: Props) {
  const [typed, setTyped] = useState('')
  const locked = requireTypedText !== undefined && typed.trim() !== requireTypedText

  return (
    <BottomSheet
      label={title}
      onClose={onCancel}
      backdropTestId="confirm-backdrop"
      panelClassName="absolute bottom-0 left-0 right-0 bg-white rounded-t-[16px] max-w-lg mx-auto px-4 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
    >
      <p className="text-[15px] font-bold text-[#1a2530]">{title}</p>
      {description && <p className="text-xs text-[#52707f] mt-2 leading-relaxed">{description}</p>}

      {requireTypedText !== undefined && (
        <input
          aria-label="請輸入旅程名稱以確認"
          className="w-full border border-[#e8edf2] rounded-[8px] px-3 py-2 text-sm text-[#1a2530] mt-3"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
      )}

      <div className="flex gap-2 mt-5">
        <button
          onClick={onCancel}
          className="flex-1 border border-[#e8edf2] text-[#5a7a8a] rounded-[10px] py-2.5 text-sm font-semibold active:opacity-70"
        >
          取消
        </button>
        <button
          onClick={onConfirm}
          disabled={locked}
          className={`flex-1 rounded-[10px] py-2.5 text-sm font-semibold disabled:opacity-40 active:opacity-80 ${
            destructive ? 'bg-[#dc2626] text-white' : 'bg-[#0077b6] text-white'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </BottomSheet>
  )
}
```

`src/App.tsx`：在兩個 `return` 的最外層各包一次 `<Toast />`。已登入的分支改成：

```tsx
  return (
    <>
      <PendingJoinRedirect />
      <Routes>
        {/* ...unchanged... */}
      </Routes>
      <Toast />
    </>
  )
```

未登入分支同樣包成 fragment 並加上 `<Toast />`。

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test`
Expected: PASS，測試數 +6。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "✨ feat(ui): add Toast and ConfirmSheet to replace native dialogs"
```

---

## Task 4: 替換全部 15 處原生對話框

**Files:**
- Modify: `src/components/MembersSection.tsx:45`、`src/components/EventSheet.tsx:80,104,136,144,150`、`src/components/AccountSheet.tsx:30`、`src/pages/SettingsPage.tsx:45,66,71,73,81,84,91,93`
- Test: `src/__tests__/components/EventSheet.test.tsx`、`src/__tests__/pages/SettingsPage.test.tsx`（新建）

**Interfaces:**
- Consumes: `toast`（Task 3）、`ConfirmSheet`（Task 3）、`WriteResult`（Task 2）
- Produces: 無新介面

- [ ] **Step 1: 先寫失敗的測試**

`src/__tests__/components/EventSheet.test.tsx` 追加：

```tsx
  it('confirms deletion through ConfirmSheet, not window.confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    renderSheet({ event: existingEvent })

    await userEvent.click(screen.getByRole('button', { name: /刪除/ }))

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(screen.getByText('確定刪除這個行程?')).toBeInTheDocument()
  })
```

（`renderSheet` 與 `existingEvent` 沿用該檔既有的 helper；若檔內沿用的是 inline render，照該檔現有寫法建立同等的 render 呼叫。）

新建 `src/__tests__/pages/SettingsPage.test.tsx`：

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const mockUseTrip = vi.fn()
const mockDeleteTrip = vi.fn()
vi.mock('../../hooks/useTrip', () => ({ useTrip: () => mockUseTrip() }))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'owner@test.com', user_metadata: {} } }),
}))
vi.mock('../../lib/db', () => ({
  updateTrip: vi.fn(async () => ({ ok: true })),
  updateTripDates: vi.fn(async () => ({ ok: true })),
  deleteTrip: (...args: unknown[]) => mockDeleteTrip(...args),
  removeMember: vi.fn(async () => true),
}))
vi.mock('../../components/MembersSection', () => ({ MembersSection: () => null }))

import { SettingsPage } from '../../pages/SettingsPage'

const trip = {
  id: 't1', name: '沖繩四日遊', owner_email: 'owner@test.com',
  members: [], start_date: '2026-10-12', end_date: '2026-10-15',
}

function renderPage() {
  mockUseTrip.mockReturnValue({ trip, days: [], loading: false })
  return render(
    <MemoryRouter initialEntries={['/trips/t1/settings']}>
      <Routes>
        <Route path="/trips/:tripId/settings" element={<SettingsPage />} />
        <Route path="/" element={<div data-testid="trip-list" />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('SettingsPage delete flow', () => {
  beforeEach(() => vi.clearAllMocks())

  it('asks for the trip name in a ConfirmSheet instead of window.prompt', async () => {
    const promptSpy = vi.spyOn(window, 'prompt')
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: '刪除旅程' }))

    expect(promptSpy).not.toHaveBeenCalled()
    expect(screen.getByLabelText('請輸入旅程名稱以確認')).toBeInTheDocument()
  })

  it('only deletes once the typed name matches', async () => {
    mockDeleteTrip.mockResolvedValue(true)
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: '刪除旅程' }))
    const input = screen.getByLabelText('請輸入旅程名稱以確認')
    const confirm = screen.getAllByRole('button', { name: '刪除旅程' })
      .find(b => b.closest('[role="dialog"]'))!

    await userEvent.type(input, '沖繩')
    expect(confirm).toBeDisabled()

    await userEvent.clear(input)
    await userEvent.type(input, '沖繩四日遊')
    await userEvent.click(confirm)

    expect(mockDeleteTrip).toHaveBeenCalledWith('t1')
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/__tests__/pages/SettingsPage.test.tsx src/__tests__/components/EventSheet.test.tsx`
Expected: FAIL — 找不到 `請輸入旅程名稱以確認`；`window.prompt` 被呼叫。

- [ ] **Step 3: 寫最小實作**

替換對照表（全部把訊息改由 `toast()` 顯示，確認流程改由 `ConfirmSheet` 承擔）：

| 位置 | 原本 | 改成 |
|---|---|---|
| `MembersSection.tsx:45` | `window.alert('移除失敗,請再試一次。')` | `toast('移除失敗,請再試一次')` |
| `EventSheet.tsx:80` | `alert('圖片不能超過 5MB')` | `toast('圖片不能超過 5MB')` |
| `EventSheet.tsx:104` | `alert('圖片上傳失敗，請重試')` | `toast('圖片上傳失敗,請再試一次')` |
| `EventSheet.tsx:136` | `alert('儲存失敗，請重試')` | `toast('儲存失敗,請再試一次')` |
| `EventSheet.tsx:144` | `window.confirm('確定刪除？...')` | `ConfirmSheet`，title `確定刪除這個行程?`、description `此動作無法復原。`、confirmLabel `刪除`、`destructive` |
| `EventSheet.tsx:150` | `alert('刪除失敗，請重試')` | `toast('刪除失敗,請再試一次')` |
| `AccountSheet.tsx:30` | `window.alert('名稱儲存失敗...')` | `toast('名稱儲存失敗,請再試一次')` |
| `SettingsPage.tsx:45` | `window.alert('名稱儲存失敗...')` | `toast('名稱儲存失敗,請再試一次')` |
| `SettingsPage.tsx:66` | `window.confirm('確定要退出這個旅程嗎?')` | `ConfirmSheet`，title `確定要退出這個旅程?`、description `退出後就看不到這趟的行程了。`、confirmLabel `退出旅程`、`destructive` |
| `SettingsPage.tsx:71,73` | `window.alert('退出失敗...')` | `toast('退出失敗,請再試一次')` |
| `SettingsPage.tsx:81,84` | `window.prompt` + 名稱比對 | `ConfirmSheet` 加 `requireTypedText={trip.name}` |
| `SettingsPage.tsx:91` | `window.alert('刪除失敗,只有主揪...')` | `toast('刪除失敗,只有主揪可以刪除旅程')` |
| `SettingsPage.tsx:93` | `window.alert('刪除失敗...')` | `toast('刪除失敗,請再試一次')` |

`SettingsPage` 用一個 state 管理目前開啟的確認框：

```tsx
  const [confirm, setConfirm] = useState<'leave' | 'delete' | null>(null)
```

危險區的按鈕改為 `onClick={() => setConfirm('delete')}` / `setConfirm('leave')`，
原本的 `handleDelete` / `handleLeave` 去掉對話框邏輯、只留寫入，並在結尾 `setConfirm(null)`。
渲染：

```tsx
      {confirm === 'delete' && trip && (
        <ConfirmSheet
          title="刪除旅程"
          description="此動作無法復原,所有行程與圖片將一併刪除。"
          confirmLabel="刪除旅程"
          requireTypedText={trip.name}
          destructive
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'leave' && (
        <ConfirmSheet
          title="確定要退出這個旅程?"
          description="退出後就看不到這趟的行程了。"
          confirmLabel="退出旅程"
          destructive
          onConfirm={handleLeave}
          onCancel={() => setConfirm(null)}
        />
      )}
```

`EventSheet` 同樣加 `const [confirmDelete, setConfirmDelete] = useState(false)`，刪除鈕改成開啟確認框。

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test && ! grep -rn -e 'window\.alert' -e 'window\.confirm' -e 'window\.prompt' -e '[^.]alert(' src --exclude-dir=__tests__`
Expected: 測試 PASS，且 grep 找不到任何原生對話框（`!` 讓 grep 無結果時整條指令回傳成功）。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "💄 style(ui): replace all native dialogs with ConfirmSheet and Toast"
```

---

## Task 5: 同步狀態改由實際連線狀態驅動

**Files:**
- Create: `src/lib/realtime.ts`
- Modify: `src/lib/db.ts`（三處 `.subscribe()`）、`src/hooks/useSyncStatus.ts`、`src/components/SyncIndicator.tsx`
- Test: `src/__tests__/lib/realtime.test.ts`、`src/__tests__/hooks/useSyncStatus.test.ts`、`src/__tests__/components/SyncIndicator.test.tsx`

**Interfaces:**
- Consumes: 無
- Produces:
  - `src/lib/realtime.ts`：`type ChannelStatus = 'connecting' | 'connected' | 'error'`、
    `reportChannelStatus(supabaseStatus: string): void`、`getChannelStatus(): ChannelStatus`、
    `onChannelStatus(listener: (s: ChannelStatus) => void): () => void`
  - `useSyncStatus(): 'connected' | 'connecting' | 'error' | 'offline'`（型別 `SyncStatus` 同步更新）

- [ ] **Step 1: 先寫失敗的測試**

`src/__tests__/lib/realtime.test.ts`：

```ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { reportChannelStatus, getChannelStatus, onChannelStatus } from '../../lib/realtime'

describe('realtime status store', () => {
  it('maps SUBSCRIBED to connected', () => {
    reportChannelStatus('SUBSCRIBED')
    expect(getChannelStatus()).toBe('connected')
  })

  it.each(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'])('maps %s to error', (raw) => {
    reportChannelStatus('SUBSCRIBED')
    reportChannelStatus(raw)
    expect(getChannelStatus()).toBe('error')
  })

  it('notifies listeners only on change', () => {
    reportChannelStatus('SUBSCRIBED')
    const listener = vi.fn()
    const off = onChannelStatus(listener)
    reportChannelStatus('SUBSCRIBED')
    expect(listener).not.toHaveBeenCalled()
    reportChannelStatus('CLOSED')
    expect(listener).toHaveBeenCalledWith('error')
    off()
    reportChannelStatus('SUBSCRIBED')
    expect(listener).toHaveBeenCalledOnce()
  })
})
```

`src/__tests__/hooks/useSyncStatus.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { reportChannelStatus } from '../../lib/realtime'
import { useSyncStatus } from '../../hooks/useSyncStatus'

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

describe('useSyncStatus', () => {
  beforeEach(() => setOnline(true))

  it('reports offline regardless of channel state when the browser is offline', () => {
    setOnline(false)
    reportChannelStatus('SUBSCRIBED')
    const { result } = renderHook(() => useSyncStatus())
    expect(result.current).toBe('offline')
  })

  it('reports connected when the channel is subscribed', () => {
    reportChannelStatus('SUBSCRIBED')
    const { result } = renderHook(() => useSyncStatus())
    expect(result.current).toBe('connected')
  })

  it('reports error when the channel drops while still online', () => {
    reportChannelStatus('SUBSCRIBED')
    const { result } = renderHook(() => useSyncStatus())
    act(() => reportChannelStatus('CHANNEL_ERROR'))
    expect(result.current).toBe('error')
  })
})
```

`src/__tests__/components/SyncIndicator.test.tsx`：

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SyncIndicator } from '../../components/SyncIndicator'

describe('SyncIndicator', () => {
  it('renders nothing when connected', () => {
    const { container } = render(<SyncIndicator status="connected" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('warns honestly when offline', () => {
    render(<SyncIndicator status="offline" />)
    expect(screen.getByText('離線,只能檢視')).toBeInTheDocument()
  })

  it('warns when the connection dropped', () => {
    render(<SyncIndicator status="error" />)
    expect(screen.getByText('連線中斷,重新整理')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/__tests__/lib/realtime.test.ts src/__tests__/hooks/useSyncStatus.test.ts src/__tests__/components/SyncIndicator.test.tsx`
Expected: FAIL — `src/lib/realtime` 無法解析；`SyncIndicator` 在 connected 時仍渲染「已同步」。

- [ ] **Step 3: 寫最小實作**

`src/lib/realtime.ts`：

```ts
export type ChannelStatus = 'connecting' | 'connected' | 'error'

// ponytail: one global status for all channels — they share a socket, so a
// per-channel breakdown would tell the user nothing extra.
let current: ChannelStatus = 'connecting'
const listeners = new Set<(s: ChannelStatus) => void>()

/** Map a Supabase channel subscribe() status onto our three states. */
export function reportChannelStatus(supabaseStatus: string): void {
  const next: ChannelStatus = supabaseStatus === 'SUBSCRIBED' ? 'connected' : 'error'
  if (next === current) return
  current = next
  listeners.forEach((l) => l(next))
}

export function getChannelStatus(): ChannelStatus {
  return current
}

export function onChannelStatus(listener: (s: ChannelStatus) => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
```

`src/lib/db.ts`：三處 `.subscribe()` 全改為 `.subscribe(reportChannelStatus)`，
並在檔首加 `import { reportChannelStatus } from './realtime'`。

`src/hooks/useSyncStatus.ts` 整支改寫：

```ts
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
```

`src/components/SyncIndicator.tsx` 整支改寫：

```tsx
import type { SyncStatus } from '../hooks/useSyncStatus'

// Only speak up when something is wrong. A green "已同步" badge that is really
// just navigator.onLine was lying whenever the socket dropped.
const WARNINGS: Partial<Record<SyncStatus, string>> = {
  offline: '離線,只能檢視',
  error: '連線中斷,重新整理',
}

export function SyncIndicator({ status }: { status: SyncStatus }) {
  const text = WARNINGS[status]
  if (!text) return null

  return (
    <div className="flex items-center gap-1.5" role="status">
      <span className="w-2 h-2 rounded-full bg-[#dc2626] shrink-0" />
      <span className="text-[11px] text-[#dc2626] whitespace-nowrap">{text}</span>
    </div>
  )
}
```

`connecting` 不顯示任何東西（開頁瞬間閃一個警告比沒有更糟）。

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test && npx tsc -b`
Expected: PASS。`TimelinePage.test.tsx` 既有的 `vi.mock('../../hooks/useSyncStatus', () => ({ useSyncStatus: () => 'synced' }))` 需一併改成 `'connected'`。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "🐛 fix(sync): drive sync badge from real channel state, warn only on trouble"
```

---

## Task 6: 旅程列表排序

**Files:**
- Modify: `src/lib/db.ts:118`（移除 `.order()`）、`src/lib/dates.ts`（新增 `sortTrips`）、`src/pages/TripListPage.tsx`
- Test: `src/__tests__/lib/dates.test.ts`、`src/__tests__/pages/TripListPage.test.tsx`

**Interfaces:**
- Consumes: `tripStatus`（既有，`src/lib/dates.ts`）
- Produces: `sortTrips<T extends { start_date: string; end_date: string }>(trips: T[], today?: string): { ongoing: T[]; upcoming: T[]; ended: T[] }`

- [ ] **Step 1: 先寫失敗的測試**

`src/__tests__/lib/dates.test.ts` 追加（import 加入 `sortTrips`）：

```ts
describe('sortTrips', () => {
  const t = (id: string, start: string, end: string) => ({ id, start_date: start, end_date: end })

  it('puts the soonest upcoming trip first', () => {
    const { upcoming } = sortTrips(
      [t('far', '2026-12-01', '2026-12-05'), t('soon', '2026-09-20', '2026-09-22')],
      '2026-09-08'
    )
    expect(upcoming.map(x => x.id)).toEqual(['soon', 'far'])
  })

  it('puts the most recently ended trip first', () => {
    const { ended } = sortTrips(
      [t('old', '2025-01-01', '2025-01-05'), t('recent', '2026-08-01', '2026-08-05')],
      '2026-09-08'
    )
    expect(ended.map(x => x.id)).toEqual(['recent', 'old'])
  })

  it('separates the ongoing trip from the rest', () => {
    const { ongoing, upcoming, ended } = sortTrips(
      [t('now', '2026-09-07', '2026-09-10'), t('later', '2026-10-01', '2026-10-03'), t('done', '2026-01-01', '2026-01-02')],
      '2026-09-08'
    )
    expect(ongoing.map(x => x.id)).toEqual(['now'])
    expect(upcoming.map(x => x.id)).toEqual(['later'])
    expect(ended.map(x => x.id)).toEqual(['done'])
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/__tests__/lib/dates.test.ts`
Expected: FAIL — `sortTrips is not exported`。

- [ ] **Step 3: 寫最小實作**

`src/lib/dates.ts` 追加：

```ts
/** Group trips by status, each group ordered the way a traveller reads it:
 *  ongoing and upcoming soonest-first, ended most-recent-first. */
export function sortTrips<T extends { start_date: string; end_date: string }>(
  trips: T[],
  today = todayStr()
): { ongoing: T[]; upcoming: T[]; ended: T[] } {
  const ongoing: T[] = []
  const upcoming: T[] = []
  const ended: T[] = []

  for (const trip of trips) {
    const bucket = { ongoing, upcoming, ended }[tripStatus(trip.start_date, trip.end_date, today)]
    bucket.push(trip)
  }

  ongoing.sort((a, b) => a.start_date.localeCompare(b.start_date))
  upcoming.sort((a, b) => a.start_date.localeCompare(b.start_date))
  ended.sort((a, b) => b.end_date.localeCompare(a.end_date))

  return { ongoing, upcoming, ended }
}
```

`src/lib/db.ts` 的 `listMyTrips` 移除 `.order('start_date', { ascending: false })`（排序改由客戶端負責），select 之後直接 map。

`src/pages/TripListPage.tsx` 把原本的兩個 `filter` 換成：

```tsx
  const { ongoing, upcoming, ended } = sortTrips(trips ?? [])
  const active = [...ongoing, ...upcoming]
```

其餘 render 邏輯不變。

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test`
Expected: PASS，測試數 +3。既有的 `TripListPage.test.tsx` 若有依賴排序的斷言，一併更新為新順序。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "🐛 fix(trips): order trip list by how soon it matters"
```

---

## Task 7: 行程卡的空時間、導航連結與無障礙

**Files:**
- Modify: `src/components/EventCard.tsx`、`src/components/ForkCard.tsx`、`src/components/EventDetailSheet.tsx`
- Modify: `src/lib/dates.ts`（新增 `mapsUrl`；放這裡是因為它與 `fmtRange` 同屬 UI 格式化的純函式層）
- Test: `src/__tests__/components/EventCard.test.tsx`、`src/__tests__/components/EventDetailSheet.test.tsx`、`src/__tests__/lib/dates.test.ts`

**Interfaces:**
- Consumes: 無
- Produces: `mapsUrl(location: string): string` — 從 `src/lib/dates.ts` 匯出。

- [ ] **Step 1: 先寫失敗的測試**

`src/__tests__/lib/dates.test.ts` 追加（import 加入 `mapsUrl`）：

```ts
  it('mapsUrl encodes the location into a Google Maps search', () => {
    expect(mapsUrl('美麗海水族館')).toBe(
      'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('美麗海水族館')
    )
  })
```

`src/__tests__/components/EventCard.test.tsx` 追加：

```tsx
  it('omits the time row when both times are empty', () => {
    render(<EventCard event={{ ...baseEvent, time_start: '', time_end: '' }} onClick={vi.fn()} />)
    expect(screen.queryByText('–', { exact: false })).not.toBeInTheDocument()
  })

  it('shows only the start time when there is no end time', () => {
    render(<EventCard event={{ ...baseEvent, time_start: '09:00', time_end: '' }} onClick={vi.fn()} />)
    expect(screen.getByText('09:00')).toBeInTheDocument()
  })

  it('links the location to Google Maps', () => {
    render(<EventCard event={{ ...baseEvent, location: '本部町' }} onClick={vi.fn()} />)
    const link = screen.getByRole('link', { name: '導航到 本部町' })
    expect(link).toHaveAttribute('href', expect.stringContaining(encodeURIComponent('本部町')))
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('exposes the title to assistive tech instead of a generic label', () => {
    render(<EventCard event={baseEvent} onClick={vi.fn()} />)
    expect(screen.queryByRole('button', { name: '查看行程' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(baseEvent.title) })).toBeInTheDocument()
  })
```

（`baseEvent` 沿用該檔既有的 fixture；若名稱不同，照該檔現有命名。）

`src/__tests__/components/EventDetailSheet.test.tsx` 追加：

```tsx
  it('links the location to Google Maps', () => {
    renderSheet({ ...baseEvent, location: '本部町' })
    expect(screen.getByRole('link', { name: '導航到 本部町' })).toBeInTheDocument()
  })
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/__tests__/components/EventCard.test.tsx src/__tests__/components/EventDetailSheet.test.tsx src/__tests__/lib/dates.test.ts`
Expected: FAIL — `mapsUrl` 未匯出、找不到導航連結、`查看行程` 仍存在。

- [ ] **Step 3: 寫最小實作**

`src/lib/dates.ts` 追加：

```ts
/** Google Maps search link for a free-text place name. */
export function mapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
}
```

`src/components/EventCard.tsx`：

- 移除 `aria-label="查看行程"`。
- 時間那一行改成：

```tsx
          {(event.time_start || event.time_end) && (
            <p className="text-xs text-[#52707f] mb-1">
              {event.time_start && event.time_end
                ? `${event.time_start} – ${event.time_end}`
                : event.time_start || event.time_end}
            </p>
          )}
```

- 地點那一行改成文字＋導航連結。連結必須擋掉冒泡，否則會同時觸發卡片的 `onClick`：

```tsx
          {event.location && (
            <p className="text-xs text-[#5a7a8a] mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>{event.location}</span>
              <a
                href={mapsUrl(event.location)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`導航到 ${event.location}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[#0077b6] font-semibold"
              >
                導航
              </a>
            </p>
          )}
```

**注意**：`EventCard` 的外層是 `<button>`，HTML 不允許 `<button>` 內含 `<a>`。
把外層 `<button>` 改成 `<div role="button" tabIndex={0}>`，並加上鍵盤處理：

```tsx
      onClick={() => onClick(event)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(event)
        }
      }}
```

`src/components/ForkCard.tsx`：同樣移除 `aria-label="查看行程"`，並比照改成
`<div role="button" tabIndex={0}>` 加鍵盤處理（Task 14 會再改它的版面，這裡只動語意）。
每組的 `item.location` 加上同樣的導航連結。

`src/components/EventDetailSheet.tsx`：地點那一行比照加上導航連結（它不在 button 內，可直接放 `<a>`）。

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "✨ feat(events): add maps navigation, fix empty time row and card a11y"
```

---

## Task 8: Realtime channel 收斂為整趟一條

**Files:**
- Modify: `src/lib/db.ts`（`subscribeToEvents` → `subscribeToTripEvents`）、`src/hooks/useTrip.ts`、`src/pages/TimelinePage.tsx`、`src/components/DaySection.tsx`
- Delete: `src/hooks/useEvents.ts`
- Test: `src/__tests__/lib/db.test.ts`、`src/__tests__/hooks/useTrip.test.ts`（新建）

**Interfaces:**
- Consumes: `reportChannelStatus`（Task 5）
- Produces:
  - `subscribeToTripEvents(tripId: string, onEvents: (byDay: Record<string, TripEvent[]>) => void): () => void`
  - `useTrip(tripId: string | null): { trip: Trip | null; days: Day[]; eventsByDay: Record<string, TripEvent[]>; loading: boolean }`
  - `DaySection` 新增必填 prop `events: TripEvent[]`

- [ ] **Step 1: 先寫失敗的測試**

`src/__tests__/lib/db.test.ts` 追加（import 加入 `subscribeToTripEvents`）：

```ts
describe('subscribeToTripEvents', () => {
  it('fetches every event for the trip and groups them by day', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        { id: 'e1', day_id: 'd1', title: 'A', sort_order: 0 },
        { id: 'e2', day_id: 'd2', title: 'B', sort_order: 0 },
        { id: 'e3', day_id: 'd1', title: 'C', sort_order: 1 },
      ],
    })
    const eq = vi.fn(() => ({ order }))
    mockFrom.mockReturnValue({ select: vi.fn(() => ({ eq })) })

    const received: Record<string, unknown[]>[] = []
    subscribeToTripEvents('t1', (byDay) => received.push(byDay))
    await vi.waitFor(() => expect(received).toHaveLength(1))

    expect(eq).toHaveBeenCalledWith('trip_id', 't1')
    expect(Object.keys(received[0]).sort()).toEqual(['d1', 'd2'])
    expect(received[0].d1).toHaveLength(2)
    expect(received[0].d2).toHaveLength(1)
  })

  it('opens exactly one channel', () => {
    const order = vi.fn().mockResolvedValue({ data: [] })
    mockFrom.mockReturnValue({ select: vi.fn(() => ({ eq: vi.fn(() => ({ order })) })) })
    mockChannel.mockClear()
    subscribeToTripEvents('t1', () => {})
    expect(mockChannel).toHaveBeenCalledOnce()
  })
})
```

新建 `src/__tests__/hooks/useTrip.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const { tripCb, daysCb, eventsCb } = vi.hoisted(() => ({
  tripCb: { current: null as ((t: unknown) => void) | null },
  daysCb: { current: null as ((d: unknown) => void) | null },
  eventsCb: { current: null as ((e: unknown) => void) | null },
}))

vi.mock('../../lib/db', () => ({
  subscribeToTrip: (_id: string, cb: (t: unknown) => void) => { tripCb.current = cb; return () => {} },
  subscribeToDays: (_id: string, cb: (d: unknown) => void) => { daysCb.current = cb; return () => {} },
  subscribeToTripEvents: (_id: string, cb: (e: unknown) => void) => { eventsCb.current = cb; return () => {} },
}))

import { useTrip } from '../../hooks/useTrip'

describe('useTrip', () => {
  beforeEach(() => localStorage.clear())

  it('exposes events grouped by day', async () => {
    const { result } = renderHook(() => useTrip('t1'))
    eventsCb.current!({ d1: [{ id: 'e1' }] })
    await waitFor(() => expect(result.current.eventsByDay.d1).toHaveLength(1))
  })

  it('caches events per trip, not per day', async () => {
    const { result } = renderHook(() => useTrip('t1'))
    eventsCb.current!({ d1: [{ id: 'e1' }] })
    await waitFor(() => expect(localStorage.getItem('sb_events_t1')).toBeTruthy())
    expect(result.current.eventsByDay.d1).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/__tests__/lib/db.test.ts src/__tests__/hooks/useTrip.test.ts`
Expected: FAIL — `subscribeToTripEvents is not exported`。

- [ ] **Step 3: 寫最小實作**

`src/lib/db.ts`：刪除 `subscribeToEvents`，換成

```ts
export function subscribeToTripEvents(
  tripId: string,
  onEvents: (byDay: Record<string, TripEvent[]>) => void
): () => void {
  const fetch = async () => {
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('trip_id', tripId)
      .order('sort_order')

    const byDay: Record<string, TripEvent[]> = {}
    for (const row of (data ?? []) as (TripEvent & { day_id: string })[]) {
      (byDay[row.day_id] ??= []).push(row)
    }
    onEvents(byDay)
  }
  fetch()

  const channel = supabase
    .channel(`trip-events-${tripId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `trip_id=eq.${tripId}` }, fetch)
    .subscribe(reportChannelStatus)

  return () => { supabase.removeChannel(channel) }
}
```

`src/hooks/useTrip.ts`：加入第三個訂閱與 `sb_events_<tripId>` 快取

```ts
const EVENTS_CACHE = (id: string) => `sb_events_${id}`
```

```ts
  const [eventsByDay, setEventsByDay] = useState<Record<string, TripEvent[]>>(
    () => (tripId ? (readCache<Record<string, TripEvent[]>>(EVENTS_CACHE(tripId)) ?? {}) : {})
  )
```

```ts
    const eventsUnsub = subscribeToTripEvents(tripId, (e) => {
      setEventsByDay(e)
      localStorage.setItem(EVENTS_CACHE(tripId), JSON.stringify(e))
    })

    return () => { tripUnsub(); daysUnsub(); eventsUnsub() }
```

回傳 `{ trip, days, eventsByDay, loading }`。

刪除 `src/hooks/useEvents.ts` 與 `src/__tests__/` 下任何針對它的測試。

`src/pages/TimelinePage.tsx`：`const { trip, days, eventsByDay, loading } = useTrip(...)`，
渲染時傳下去：

```tsx
            <DaySection
              key={day.id}
              day={day}
              tripId={trip.id}
              members={trip.members}
              events={eventsByDay[day.id] ?? []}
            />
```

`src/components/DaySection.tsx`：`Props` 加 `events: TripEvent[]`，移除
`const events = useEvents(...)` 與該 import，改由 prop 取得。

`src/__tests__/pages/TimelinePage.test.tsx` 的 `mockUseTrip.mockReturnValue`
全部補上 `eventsByDay: {}`。

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test && npx tsc -b`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "⚡️ perf(realtime): collapse per-day event channels into one per trip"
```

---

## Task 9: 現在時間線改用時間定位並隨時鐘推進

**Files:**
- Modify: `src/components/DaySection.tsx:100-108`（`nowIndex` 計算）、`src/lib/dates.ts`（新增 `nowLineIndex`）
- Test: `src/__tests__/lib/dates.test.ts`、`src/__tests__/components/DaySection.test.tsx`（新建）

**Interfaces:**
- Consumes: `useNow`（Task 1）、`hhmm`（Task 1）、`DaySection` 的 `events` prop（Task 8）
- Produces: `nowLineIndex(events: { time_start: string }[], now: string): number` — 時間線該插在第幾個位置（0 = 最前，`events.length` = 最後）。

- [ ] **Step 1: 先寫失敗的測試**

`src/__tests__/lib/dates.test.ts` 追加（import 加入 `nowLineIndex`）：

```ts
describe('nowLineIndex', () => {
  it('inserts after the last already-started event even when the list is out of time order', () => {
    // Dragged out of order: 14:00 sits before 09:00 in the list.
    const events = [{ time_start: '14:00' }, { time_start: '09:00' }, { time_start: '18:00' }]
    expect(nowLineIndex(events, '10:00')).toBe(2)
  })

  it('inserts at the front when nothing has started', () => {
    expect(nowLineIndex([{ time_start: '09:00' }, { time_start: '12:00' }], '08:00')).toBe(0)
  })

  it('inserts at the end when everything has started', () => {
    expect(nowLineIndex([{ time_start: '09:00' }, { time_start: '12:00' }], '23:00')).toBe(2)
  })

  it('ignores events without a start time', () => {
    expect(nowLineIndex([{ time_start: '' }, { time_start: '09:00' }], '10:00')).toBe(2)
  })
})
```

新建 `src/__tests__/components/DaySection.test.tsx`：

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../lib/db', () => ({
  reorderEvents: vi.fn(async () => ({ ok: true })),
  updateDayLabel: vi.fn(async () => ({ ok: true })),
}))
vi.mock('../../components/EventSheet', () => ({ EventSheet: () => null }))
vi.mock('../../components/EventDetailSheet', () => ({ EventDetailSheet: () => null }))
vi.mock('../../hooks/useNow', () => ({ useNow: () => new Date('2026-10-12T10:00:00') }))

import { DaySection } from '../../components/DaySection'

const day = { id: 'd1', date: '2026-10-12', label: '', sort_order: 0 }
const ev = (id: string, time_start: string) => ({
  id, type: 'shared' as const, title: id, time_start, time_end: '',
  location: '', notes: '', sort_order: 0,
})

describe('DaySection now line', () => {
  it('places the now line after the last started event despite list order', () => {
    render(
      <DaySection day={day} tripId="t1" members={[]} events={[ev('b', '14:00'), ev('a', '09:00'), ev('c', '18:00')]} />
    )
    const cards = screen.getAllByRole('button', { name: /^[abc]$/ })
    const line = screen.getByTestId('now-line')
    // The line sits between 'a' (started) and 'c' (not yet).
    expect(line.compareDocumentPosition(cards[1]) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    expect(line.compareDocumentPosition(cards[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders no now line on a day that is not today', () => {
    render(
      <DaySection day={{ ...day, date: '2026-10-13' }} tripId="t1" members={[]} events={[ev('a', '09:00')]} />
    )
    expect(screen.queryByTestId('now-line')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/__tests__/lib/dates.test.ts src/__tests__/components/DaySection.test.tsx`
Expected: FAIL — `nowLineIndex is not exported`；時間線位置錯誤（現行實作用 `filter().length` 會算成 1）。

- [ ] **Step 3: 寫最小實作**

`src/lib/dates.ts` 追加：

```ts
/** Where to insert the "now" line in a list ordered by sort_order, not time.
 *  Answers: one past the last event that has already started. */
export function nowLineIndex(events: { time_start: string }[], now: string): number {
  let index = 0
  events.forEach((e, i) => {
    if (e.time_start && e.time_start <= now) index = i + 1
  })
  return index
}
```

`src/components/DaySection.tsx`：把

```ts
  const now = new Date()
  const isToday = day.date === todayStr(now)
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const nowIndex = isToday
    ? events.filter((e) => e.time_start && e.time_start <= nowTime).length
    : -1
```

換成

```ts
  const now = useNow()
  const isToday = day.date === todayStr(now)
  const nowTime = hhmm(now)
  const nowIndex = isToday ? nowLineIndex(events, nowTime) : -1
```

並移除那條 `// ponytail: now-line position computed at render` 註解（不再適用）。
import 加上 `useNow`、`hhmm`、`nowLineIndex`。

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test`
Expected: PASS，測試數 +6。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "🐛 fix(timeline): place now line by time and advance it every minute"
```

---

## Task 10: 「現在」區塊

**Files:**
- Create: `src/components/NowSection.tsx`
- Modify: `src/lib/dates.ts`（新增 `pickNow`）、`src/pages/TimelinePage.tsx`
- Test: `src/__tests__/lib/dates.test.ts`、`src/__tests__/components/NowSection.test.tsx`

**Interfaces:**
- Consumes: `useNow`（Task 1）、`hhmm` / `todayStr` / `mapsUrl`（Task 1、7）、`eventsByDay`（Task 8）、`Day` / `TripEvent`（`src/types.ts`）
- Produces:
  - `pickNow(args: { days: Day[]; eventsByDay: Record<string, TripEvent[]>; now: Date }): { current: TripEvent[]; next: TripEvent[]; nextLabel: '接下來' | '明天' }`
  - `<NowSection days eventsByDay onOpen />`，`onOpen: (event: TripEvent) => void`

- [ ] **Step 1: 先寫失敗的測試**

`src/__tests__/lib/dates.test.ts` 追加（import 加入 `pickNow`）：

```ts
describe('pickNow', () => {
  const days = [
    { id: 'd1', date: '2026-10-12', label: '', sort_order: 0 },
    { id: 'd2', date: '2026-10-13', label: '', sort_order: 1 },
  ]
  const ev = (id: string, s: string, e: string) => ({
    id, type: 'shared' as const, title: id, time_start: s, time_end: e,
    location: '', notes: '', sort_order: 0,
  })

  it('returns the event spanning now as current and the rest of today as next', () => {
    const result = pickNow({
      days,
      eventsByDay: { d1: [ev('a', '09:00', '12:00'), ev('b', '12:30', '13:30'), ev('c', '14:00', '16:00')] },
      now: new Date('2026-10-12T10:00:00'),
    })
    expect(result.current.map(e => e.id)).toEqual(['a'])
    expect(result.next.map(e => e.id)).toEqual(['b', 'c'])
    expect(result.nextLabel).toBe('接下來')
  })

  it('caps next at three entries', () => {
    const result = pickNow({
      days,
      eventsByDay: { d1: ['b', 'c', 'd', 'e'].map((id, i) => ev(id, `1${i + 3}:00`, `1${i + 4}:00`)) },
      now: new Date('2026-10-12T10:00:00'),
    })
    expect(result.next).toHaveLength(3)
  })

  it('falls back to tomorrow when today has nothing left', () => {
    const result = pickNow({
      days,
      eventsByDay: { d1: [ev('a', '09:00', '10:00')], d2: [ev('t', '08:00', '09:00')] },
      now: new Date('2026-10-12T22:00:00'),
    })
    expect(result.current).toEqual([])
    expect(result.next.map(e => e.id)).toEqual(['t'])
    expect(result.nextLabel).toBe('明天')
  })

  it('lists every overlapping event as current', () => {
    const result = pickNow({
      days,
      eventsByDay: { d1: [ev('a', '09:00', '12:00'), ev('b', '09:30', '11:00')] },
      now: new Date('2026-10-12T10:00:00'),
    })
    expect(result.current.map(e => e.id)).toEqual(['a', 'b'])
  })

  it('returns empty when today is not part of the trip', () => {
    const result = pickNow({ days, eventsByDay: {}, now: new Date('2026-11-01T10:00:00') })
    expect(result.current).toEqual([])
    expect(result.next).toEqual([])
  })
})
```

`src/__tests__/components/NowSection.test.tsx`：

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../hooks/useNow', () => ({ useNow: () => new Date('2026-10-12T10:00:00') }))

import { NowSection } from '../../components/NowSection'

const days = [{ id: 'd1', date: '2026-10-12', label: '', sort_order: 0 }]
const ev = (id: string, title: string, s: string, e: string, location = '') => ({
  id, type: 'shared' as const, title, time_start: s, time_end: e,
  location, notes: '', sort_order: 0,
})

describe('NowSection', () => {
  it('shows the event happening now with its navigation link', () => {
    render(
      <NowSection
        days={days}
        eventsByDay={{ d1: [ev('a', '美麗海水族館', '09:00', '12:00', '本部町')] }}
        onOpen={vi.fn()}
      />
    )
    expect(screen.getByText('現在進行中')).toBeInTheDocument()
    expect(screen.getByText('美麗海水族館')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '導航到 本部町' })).toBeInTheDocument()
  })

  it('renders nothing when the trip has no events today', () => {
    const { container } = render(<NowSection days={days} eventsByDay={{}} onOpen={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('labels the fallback as 明天 when today is done', () => {
    render(
      <NowSection
        days={[...days, { id: 'd2', date: '2026-10-13', label: '', sort_order: 1 }]}
        eventsByDay={{ d1: [ev('a', '早餐', '07:00', '08:00')], d2: [ev('t', '古宇利大橋', '09:00', '11:00')] }}
        onOpen={vi.fn()}
      />
    )
    expect(screen.getByText('明天')).toBeInTheDocument()
    expect(screen.getByText('古宇利大橋')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/__tests__/lib/dates.test.ts src/__tests__/components/NowSection.test.tsx`
Expected: FAIL — `pickNow is not exported`、`NowSection` 無法解析。

- [ ] **Step 3: 寫最小實作**

`src/lib/dates.ts` 追加（需要 `Day`、`TripEvent` 型別，從 `../types` import）：

```ts
const NEXT_LIMIT = 3

/** What the traveller needs on screen right now: what is happening, what is next. */
export function pickNow({ days, eventsByDay, now }: {
  days: Day[]
  eventsByDay: Record<string, TripEvent[]>
  now: Date
}): { current: TripEvent[]; next: TripEvent[]; nextLabel: '接下來' | '明天' } {
  const time = hhmm(now)
  const today = todayStr(now)
  const todayDay = days.find(d => d.date === today)
  const todayEvents = todayDay ? (eventsByDay[todayDay.id] ?? []) : []
  const byTime = [...todayEvents].sort((a, b) => a.time_start.localeCompare(b.time_start))

  const current = byTime.filter(e => e.time_start && e.time_end && e.time_start <= time && time < e.time_end)
  const next = byTime.filter(e => e.time_start && e.time_start > time)

  if (next.length) {
    return { current, next: next.slice(0, NEXT_LIMIT), nextLabel: '接下來' }
  }

  const tomorrowIndex = days.findIndex(d => d.date === today) + 1
  const tomorrow = todayDay && tomorrowIndex < days.length ? days[tomorrowIndex] : undefined
  const tomorrowEvents = tomorrow ? (eventsByDay[tomorrow.id] ?? []) : []
  const firstTomorrow = [...tomorrowEvents]
    .sort((a, b) => a.time_start.localeCompare(b.time_start))
    .slice(0, 1)

  return { current, next: firstTomorrow, nextLabel: '明天' }
}
```

`src/components/NowSection.tsx`：

```tsx
import { useNow } from '../hooks/useNow'
import { pickNow, mapsUrl } from '../lib/dates'
import { EventCard } from './EventCard'
import type { Day, TripEvent } from '../types'

interface Props {
  days: Day[]
  eventsByDay: Record<string, TripEvent[]>
  onOpen: (event: TripEvent) => void
}

export function NowSection({ days, eventsByDay, onOpen }: Props) {
  const now = useNow()
  const { current, next, nextLabel } = pickNow({ days, eventsByDay, now })

  if (!current.length && !next.length) return null

  return (
    <section className="mb-6 flex flex-col gap-3" aria-label="現在">
      {current.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-bold text-[#dc2626] tracking-wide">現在進行中</p>
          {current.map(event => (
            <EventCard key={event.id} event={event} onClick={onOpen} />
          ))}
        </div>
      )}

      {next.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-bold text-[#52707f] tracking-wide">{nextLabel}</p>
          {next.map(event => (
            <div
              key={event.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(event)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(event) }
              }}
              className="bg-white rounded-[10px] border border-[#e8edf2] px-3 py-2 flex items-center gap-2 text-left active:opacity-70"
            >
              <span className="text-xs font-semibold text-[#52707f] shrink-0 w-11">{event.time_start}</span>
              <span className="text-sm text-[#1a2530] truncate flex-1">{event.title}</span>
              {event.location && (
                <a
                  href={mapsUrl(event.location)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`導航到 ${event.location}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs font-semibold text-[#0077b6] shrink-0"
                >
                  導航
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
```

`src/pages/TimelinePage.tsx`：在 `<main>` 內、`days.map` 之前插入

```tsx
          {tripStatus(trip.start_date, trip.end_date) === 'ongoing' && (
            <div id="now-section">
              <NowSection days={days} eventsByDay={eventsByDay} onOpen={setDetailEvent} />
            </div>
          )}
```

`TimelinePage` 需要自己的行程詳情 sheet 才能響應 `onOpen`。加入：

```tsx
  const [detailEvent, setDetailEvent] = useState<TripEvent | null>(null)
```

並在頁面底部渲染

```tsx
      <EventDetailSheet
        open={detailEvent !== null}
        event={detailEvent}
        onClose={() => setDetailEvent(null)}
        onEdit={() => setDetailEvent(null)}
      />
```

`onEdit` 只關閉——從「現在」區塊直接編輯不在本次範圍，使用者往下捲到時間軸即可編輯。
在 `EventDetailSheet` 上新增一個 `hideEdit?: boolean` prop，這裡傳 `hideEdit`，
避免出現一個按了沒反應的「編輯行程」鈕。

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test && npx tsc -b`
Expected: PASS，測試數 +8。`EventDetailSheet.test.tsx` 追加一則：`hideEdit` 時不渲染「編輯行程」。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "✨ feat(timeline): add now/next section above the itinerary"
```

---

## Task 11: 自動捲動改由資料計算

**Files:**
- Modify: `src/pages/TimelinePage.tsx:20-70`（整段 `useEffect` 換掉）、`src/lib/dates.ts`（新增 `scrollTargetEventId`）
- Test: `src/__tests__/lib/dates.test.ts`、`src/__tests__/pages/TimelinePage.test.tsx`

**Interfaces:**
- Consumes: `eventsByDay`（Task 8）、`todayStr` / `hhmm`（既有、Task 1）
- Produces: `scrollTargetEventId(args: { days: Day[]; eventsByDay: Record<string, TripEvent[]>; now: Date }): string | null`

- [ ] **Step 1: 先寫失敗的測試**

`src/__tests__/lib/dates.test.ts` 追加（import 加入 `scrollTargetEventId`）：

```ts
describe('scrollTargetEventId', () => {
  const days = [{ id: 'd1', date: '2026-10-12', label: '', sort_order: 0 }]
  const ev = (id: string, s: string, e: string) => ({
    id, type: 'shared' as const, title: id, time_start: s, time_end: e,
    location: '', notes: '', sort_order: 0,
  })

  it('picks the first event that has not ended yet', () => {
    const target = scrollTargetEventId({
      days,
      eventsByDay: { d1: [ev('done', '07:00', '08:00'), ev('live', '09:00', '12:00'), ev('later', '14:00', '16:00')] },
      now: new Date('2026-10-12T10:00:00'),
    })
    expect(target).toBe('live')
  })

  it('does not pick an event that already ended', () => {
    const target = scrollTargetEventId({
      days,
      eventsByDay: { d1: [ev('morning', '07:00', '08:00'), ev('evening', '19:00', '21:00')] },
      now: new Date('2026-10-12T10:00:00'),
    })
    expect(target).toBe('evening')
  })

  it('falls back to the first event of today when all have ended', () => {
    const target = scrollTargetEventId({
      days,
      eventsByDay: { d1: [ev('a', '07:00', '08:00'), ev('b', '09:00', '10:00')] },
      now: new Date('2026-10-12T23:00:00'),
    })
    expect(target).toBe('a')
  })

  it('returns null when today is not part of the trip', () => {
    expect(scrollTargetEventId({ days, eventsByDay: {}, now: new Date('2026-11-01T10:00:00') })).toBeNull()
  })
})
```

`src/__tests__/pages/TimelinePage.test.tsx` 追加：

```tsx
  it('scrolls to the first event that has not ended', () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    vi.setSystemTime(new Date('2026-10-12T10:00:00'))

    mockUseTrip.mockReturnValue({
      trip: { id: 't1', name: '沖繩', owner_email: 'sei@test.com', members: [], start_date: '2026-10-12', end_date: '2026-10-13' },
      days: [{ id: 'd1', date: '2026-10-12', label: '', sort_order: 0 }],
      eventsByDay: {
        d1: [
          { id: 'done', type: 'shared', title: 'x', time_start: '07:00', time_end: '08:00', location: '', notes: '', sort_order: 0 },
          { id: 'live', type: 'shared', title: 'y', time_start: '09:00', time_end: '12:00', location: '', notes: '', sort_order: 1 },
        ],
      },
      loading: false,
    })

    renderAt('/trips/t1')
    expect(document.getElementById('event-live')).toBeTruthy()
    expect(scrollIntoView).toHaveBeenCalled()
  })
```

該檔頂部加 `beforeEach(() => vi.useFakeTimers())` / `afterEach(() => vi.useRealTimers())`，
並把 `DaySection` 的 mock 改為會渲染帶 id 的節點：

```tsx
vi.mock('../../components/DaySection', () => ({
  DaySection: ({ events }: { events: { id: string }[] }) => (
    <div data-testid="day-section">
      {events.map(e => <div key={e.id} id={`event-${e.id}`} />)}
    </div>
  ),
}))
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/__tests__/lib/dates.test.ts src/__tests__/pages/TimelinePage.test.tsx`
Expected: FAIL — `scrollTargetEventId is not exported`。

- [ ] **Step 3: 寫最小實作**

`src/lib/dates.ts` 追加：

```ts
/** The event to bring into view on open: the first one today that has not ended.
 *  Falls back to today's first event; null when today is outside the trip. */
export function scrollTargetEventId({ days, eventsByDay, now }: {
  days: Day[]
  eventsByDay: Record<string, TripEvent[]>
  now: Date
}): string | null {
  const today = todayStr(now)
  const day = days.find(d => d.date === today)
  if (!day) return null

  const byTime = [...(eventsByDay[day.id] ?? [])]
    .filter(e => e.time_start)
    .sort((a, b) => a.time_start.localeCompare(b.time_start))
  if (!byTime.length) return null

  const time = hhmm(now)
  const live = byTime.find(e => (e.time_end || e.time_start) > time)
  return (live ?? byTime[0]).id
}
```

`src/pages/TimelinePage.tsx`：刪掉整段輪詢 `useEffect`（第 20–70 行），換成

```tsx
  const scrolledRef = useRef(false)

  useEffect(() => {
    if (scrolledRef.current || !days.length) return

    const targetId = scrollTargetEventId({ days, eventsByDay, now: new Date() })
    if (!targetId) return

    const el = document.getElementById(`event-${targetId}`)
    if (!el) return

    scrolledRef.current = true
    const headerHeight = document.querySelector('header')?.getBoundingClientRect().height ?? 96
    el.style.scrollMarginTop = `${headerHeight + 8}px`
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [days, eventsByDay])
```

只捲一次（`scrolledRef`），資料到齊時 effect 會重跑，不需要輪詢。

`src/components/DaySection.tsx` 的 `SortableCard` 外層 div 加 `id={`event-${event.id}`}`，
並移除已無用的 `data-date` / `data-time-start` 屬性（那是輪詢版本用來反查 DOM 的）。

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test`
Expected: PASS，測試數 +5。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "🐛 fix(timeline): compute scroll target from data, drop the DOM polling loop"
```

---

## Task 12: 導覽收成兩個 tab、刪除重複的旅伴頁

**Files:**
- Delete: `src/pages/MembersPage.tsx`
- Modify: `src/App.tsx`（移除 `/trips/:tripId/members` 路由）、`src/components/TripNav.tsx`、`src/pages/TimelinePage.tsx`、`src/pages/SettingsPage.tsx`
- Test: `src/__tests__/components/TripNav.test.tsx`（新建）、`src/__tests__/pages/TimelinePage.test.tsx`

**Interfaces:**
- Consumes: `NowSection` 的容器 id `now-section`（Task 10）
- Produces: `<TripNav onToday onTop active todayDisabled? />`
  - `onToday: () => void`、`onTop: () => void`
  - `active: 'today' | 'itinerary'`
  - `todayDisabled?: boolean` — 旅程不在進行中時停用「今天」（停用而非隱藏，避免版面跳動）
  - 不再接受 `tripId`，也不再自行導航——它只負責捲動。

- [ ] **Step 1: 先寫失敗的測試**

`src/__tests__/components/TripNav.test.tsx`：

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TripNav } from '../../components/TripNav'

describe('TripNav', () => {
  it('offers exactly two tabs', () => {
    render(<TripNav onToday={vi.fn()} onTop={vi.fn()} active="today" />)
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.getByRole('button', { name: '今天' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '行程' })).toBeInTheDocument()
  })

  it('no longer exposes a settings tab', () => {
    render(<TripNav onToday={vi.fn()} onTop={vi.fn()} active="today" />)
    expect(screen.queryByRole('button', { name: '設定' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '旅伴' })).not.toBeInTheDocument()
  })

  it('calls the scroll handlers', async () => {
    const onToday = vi.fn()
    const onTop = vi.fn()
    render(<TripNav onToday={onToday} onTop={onTop} active="itinerary" />)
    await userEvent.click(screen.getByRole('button', { name: '今天' }))
    await userEvent.click(screen.getByRole('button', { name: '行程' }))
    expect(onToday).toHaveBeenCalledOnce()
    expect(onTop).toHaveBeenCalledOnce()
  })

  it('disables 今天 when the trip is not under way', () => {
    render(<TripNav onToday={vi.fn()} onTop={vi.fn()} active="itinerary" todayDisabled />)
    expect(screen.getByRole('button', { name: '今天' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '行程' })).toBeEnabled()
  })
})
```

`src/__tests__/pages/TimelinePage.test.tsx` 追加：

```tsx
  it('opens settings from the header gear', async () => {
    mockUseTrip.mockReturnValue({
      trip: { id: 't1', name: '沖繩', owner_email: 'sei@test.com', members: [], start_date: '2026-08-01', end_date: '2026-08-02' },
      days: [{ id: 'd1', date: '2026-08-01', label: '', sort_order: 0 }],
      eventsByDay: {},
      loading: false,
    })

    renderAt('/trips/t1')
    await userEvent.click(screen.getByRole('button', { name: '旅程設定' }))
    expect(screen.getByTestId('settings-page')).toBeInTheDocument()
  })
```

`renderAt` 的 `<Routes>` 加一條 `<Route path="/trips/:tripId/settings" element={<div data-testid="settings-page" />} />`。

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/__tests__/components/TripNav.test.tsx src/__tests__/pages/TimelinePage.test.tsx`
Expected: FAIL — `TripNav` 仍要求 `tripId`、仍渲染三個 tab；找不到「旅程設定」按鈕。

- [ ] **Step 3: 寫最小實作**

`src/components/TripNav.tsx` 整支改寫（保留既有的 SVG icon 寫法，日曆 icon 給「行程」，時鐘 icon 給「今天」）：

```tsx
interface Props {
  onToday: () => void
  onTop: () => void
  active: 'today' | 'itinerary'
  todayDisabled?: boolean
}

const TABS = [
  {
    key: 'today' as const,
    label: '今天',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  },
  {
    key: 'itinerary' as const,
    label: '行程',
    icon: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
  },
]

export function TripNav({ onToday, onTop, active, todayDisabled }: Props) {
  return (
    <nav className="bg-white border-t border-[#e8edf2] flex sticky bottom-0 z-10 pb-[env(safe-area-inset-bottom)]">
      {TABS.map((tab) => {
        const isActive = tab.key === active
        const color = isActive ? '#0077b6' : '#8fa0b0'
        return (
          <button
            key={tab.key}
            onClick={tab.key === 'today' ? onToday : onTop}
            disabled={tab.key === 'today' && todayDisabled}
            aria-current={isActive ? 'page' : undefined}
            className="flex-1 py-2.5 flex flex-col items-center gap-0.5 disabled:opacity-40"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {tab.icon}
            </svg>
            <span className={`text-[10px] ${isActive ? 'font-bold text-[#0077b6]' : 'text-[#52707f]'}`}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
```

`src/pages/TimelinePage.tsx`：

- header 右側在頭像堆疊旁加一顆齒輪按鈕，`aria-label="旅程設定"`，
  `onClick={() => navigate(`/trips/${trip.id}/settings`)}`（齒輪 SVG path 沿用原
  `TripNav.tsx` 中 settings tab 的 path，該檔刪除前先複製過來）。
- 頭像堆疊本身也包成按鈕，同樣導向設定頁，`aria-label="旅伴"`。
- 底部改成：

```tsx
      <TripNav
        active={isOngoing ? 'today' : 'itinerary'}
        todayDisabled={!isOngoing}
        onToday={() => document.getElementById('now-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        onTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />
```

其中 `const isOngoing = tripStatus(trip.start_date, trip.end_date) === 'ongoing'`。

`src/pages/SettingsPage.tsx`：移除底部的 `TripNav` 與其 import（設定頁已經有返回鍵，
是唯一有返回鍵的頁）。頁面標題維持「設定」，`MembersSection` 的位置不動。

`src/App.tsx`：移除 `MembersPage` 的 import 與 `/trips/:tripId/members` 路由。
刪除 `src/pages/MembersPage.tsx`。

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test && npx tsc -b`
Expected: PASS。若有測試檔引用 `MembersPage`，一併刪除。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "♻️ refactor(nav): two content tabs, settings behind the header gear"
```

---

## Task 13: 上手引導

**Files:**
- Create: `src/hooks/useInviteLink.ts`、`src/components/InviteCard.tsx`
- Modify: `src/components/MembersSection.tsx`（改用 `useInviteLink`）、`src/pages/TripListPage.tsx`、`src/pages/NewTripPage.tsx`、`src/pages/TimelinePage.tsx`、`src/components/EventSheet.tsx`、`src/components/InstallPrompt.tsx`、`src/hooks/useInstallPrompt.ts`
- Test: `src/__tests__/pages/TripListPage.test.tsx`、`src/__tests__/pages/NewTripPage.test.tsx`、`src/__tests__/components/InviteCard.test.tsx`、`src/__tests__/hooks/useInstallPrompt.test.ts`（新建）

**Interfaces:**
- Consumes: `Trip`（`src/types.ts`）、`toast`（Task 3）
- Produces:
  - `useInviteLink(trip: { id: string; name: string }): { inviteUrl: string; copied: boolean; share: () => Promise<void>; copy: () => Promise<void> }`
  - `<InviteCard trip />`，`trip: Trip`。成員數 > 1 時自身回傳 `null`。

- [ ] **Step 1: 先寫失敗的測試**

`src/__tests__/components/InviteCard.test.tsx`：

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InviteCard } from '../../components/InviteCard'

const trip = (memberCount: number) => ({
  id: 't1', name: '沖繩四日遊', owner_email: 'a@test.com',
  start_date: '2026-10-12', end_date: '2026-10-15',
  members: Array.from({ length: memberCount }, (_, i) => ({
    email: `m${i}@test.com`, display_name: `M${i}`, avatar_url: '',
  })),
})

describe('InviteCard', () => {
  it('prompts to invite while the trip is a party of one', () => {
    render(<InviteCard trip={trip(1)} />)
    expect(screen.getByText('把連結傳給旅伴,一起排行程')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '分享邀請連結' })).toBeInTheDocument()
  })

  it('disappears once someone else has joined', () => {
    const { container } = render(<InviteCard trip={trip(2)} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

`src/__tests__/pages/TripListPage.test.tsx` 追加：

```tsx
  it('offers a real button in the empty state', async () => {
    mockListMyTrips.mockResolvedValue([])
    renderPage()
    const cta = await screen.findByRole('button', { name: '建立第一個旅程' })
    await userEvent.click(cta)
    expect(screen.getByTestId('new-trip')).toBeInTheDocument()
  })

  it('hides the floating add button while there are no trips', async () => {
    mockListMyTrips.mockResolvedValue([])
    renderPage()
    await screen.findByRole('button', { name: '建立第一個旅程' })
    expect(screen.queryByRole('button', { name: '新增旅程' })).not.toBeInTheDocument()
  })
```

（`mockListMyTrips`、`renderPage` 沿用該檔既有 helper；`renderPage` 的 `<Routes>`
需含 `<Route path="/trips/new" element={<div data-testid="new-trip" />} />`。）

`src/__tests__/pages/NewTripPage.test.tsx` 追加：

```tsx
  it('prefills today through today plus two days', () => {
    vi.setSystemTime(new Date('2026-09-08T12:00:00'))
    renderPage()
    expect(screen.getByLabelText('開始日期')).toHaveValue('2026-09-08')
    expect(screen.getByLabelText('結束日期')).toHaveValue('2026-09-10')
  })
```

該檔加 `beforeEach(() => vi.useFakeTimers())` / `afterEach(() => vi.useRealTimers())`。

新建 `src/__tests__/hooks/useInstallPrompt.test.ts`：

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'

function fireBeforeInstallPrompt() {
  const event = new Event('beforeinstallprompt') as Event & { prompt?: unknown }
  event.prompt = async () => {}
  window.dispatchEvent(event)
}

describe('useInstallPrompt', () => {
  beforeEach(() => localStorage.clear())

  it('offers installation when the browser fires the event', () => {
    const { result } = renderHook(() => useInstallPrompt())
    act(() => fireBeforeInstallPrompt())
    expect(result.current.canInstall).toBe(true)
  })

  it('stays quiet for 30 days after a dismissal', () => {
    const first = renderHook(() => useInstallPrompt())
    act(() => fireBeforeInstallPrompt())
    act(() => first.result.current.dismiss())
    first.unmount()

    const second = renderHook(() => useInstallPrompt())
    act(() => fireBeforeInstallPrompt())
    expect(second.result.current.canInstall).toBe(false)
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/__tests__/components/InviteCard.test.tsx src/__tests__/pages/TripListPage.test.tsx src/__tests__/pages/NewTripPage.test.tsx src/__tests__/hooks/useInstallPrompt.test.ts`
Expected: FAIL — `InviteCard` 無法解析；找不到「建立第一個旅程」；日期為空字串；dismiss 不持久。

- [ ] **Step 3: 寫最小實作**

`src/hooks/useInviteLink.ts`（把 `MembersSection` 第 20–39 行的邏輯原樣搬過來）：

```ts
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
```

`src/components/MembersSection.tsx` 改用它，刪掉自己的 `handleShare` / `handleCopy` / `copied` state。

`src/components/InviteCard.tsx`：

```tsx
import { useInviteLink } from '../hooks/useInviteLink'
import type { Trip } from '../types'

/** Shown while a trip still has exactly one member. No dismiss state needed:
 *  the card's reason to exist disappears the moment someone joins. */
export function InviteCard({ trip }: { trip: Trip }) {
  const { share } = useInviteLink(trip)

  if (trip.members.length > 1) return null

  return (
    <div className="bg-[#e3f1f9] rounded-[12px] px-4 py-3 mb-4 flex items-center gap-3">
      <p className="flex-1 text-xs text-[#1a2530]">把連結傳給旅伴,一起排行程</p>
      <button
        onClick={share}
        className="shrink-0 bg-[#0077b6] text-white text-xs font-semibold rounded-[8px] px-3 py-2 active:opacity-80"
      >
        分享邀請連結
      </button>
    </div>
  )
}
```

`src/pages/TimelinePage.tsx`：在 `<main>` 最上方、`NowSection` 之前渲染 `<InviteCard trip={trip} />`。

`src/pages/TripListPage.tsx`：空狀態改成

```tsx
        {trips?.length === 0 && !loadError && (
          <div className="flex flex-col items-center gap-4 py-12">
            <Logo size={44} />
            <p className="text-sm text-[#52707f]">還沒有旅程</p>
            <button
              onClick={() => navigate('/trips/new')}
              className="bg-[#0077b6] text-white rounded-[10px] py-3 px-6 text-sm font-semibold active:opacity-80"
            >
              建立第一個旅程
            </button>
          </div>
        )}
```

FAB 的顯示條件從 `trips !== null` 改為 `!!trips?.length`。

`src/pages/NewTripPage.tsx`：日期預設

```tsx
import { todayStr } from '../lib/dates'

const plusDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return todayStr(d)
}
```

```tsx
  const [startDate, setStartDate] = useState(() => todayStr())
  const [endDate, setEndDate] = useState(() => plusDays(2))
```

`src/components/EventSheet.tsx`：型別切換的 `</div>` 之後加說明文字

```tsx
        <p className="text-[11px] text-[#52707f] -mt-2.5 mb-4">
          {type === 'shared'
            ? '大家一起去的行程。'
            : '同一時段大家分開行動時使用,各組的安排分開記錄。'}
        </p>
```

`src/hooks/useInstallPrompt.ts`：加入 30 天靜音

```ts
const DISMISS_KEY = 'installPromptDismissedAt'
const QUIET_MS = 30 * 24 * 60 * 60 * 1000

function dismissedRecently(): boolean {
  const raw = localStorage.getItem(DISMISS_KEY)
  return !!raw && Date.now() - Number(raw) < QUIET_MS
}
```

`handler` 開頭加 `if (dismissedRecently()) return`；`dismiss` 改為

```ts
  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setPrompt(null)
  }
```

`src/components/InstallPrompt.tsx`：`bottom-20` 改成
`bottom-[calc(4.25rem+env(safe-area-inset-bottom))]`，避開底部導覽。

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test && npx tsc -b`
Expected: PASS，測試數 +6。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "✨ feat(onboarding): empty-state CTA, date defaults, invite card, fork hint"
```

---

## Task 14: 分頭行動的版面與驗證

**Files:**
- Modify: `src/components/ForkCard.tsx`、`src/components/EventSheet.tsx`
- Test: `src/__tests__/components/ForkCard.test.tsx`、`src/__tests__/components/EventSheet.test.tsx`

**Interfaces:**
- Consumes: `ForkItem`（`src/types.ts`）
- Produces: 無新介面（`EventSheet` 的 `titleMissing` 擴充為 `blockedReason: string | null`）

- [ ] **Step 1: 先寫失敗的測試**

`src/__tests__/components/ForkCard.test.tsx` 追加：

```tsx
  it('stacks groups in a single column regardless of count', () => {
    const { container } = render(
      <ForkCard
        event={{ ...baseForkEvent, fork_items: [
          { person: 'A', title: '潛水', location: '', notes: '' },
          { person: 'B', title: '購物', location: '', notes: '' },
        ] }}
        onClick={vi.fn()}
      />
    )
    const groups = container.querySelector('[data-testid="fork-groups"]')!
    expect(groups.className).toContain('flex-col')
  })
```

`src/__tests__/components/EventSheet.test.tsx` 追加：

```tsx
  it('blocks saving a fork event with an empty group', async () => {
    renderSheet({ event: null })
    await userEvent.click(screen.getByRole('button', { name: '分頭行動' }))

    const save = screen.getByRole('button', { name: '儲存' })
    expect(save).toBeDisabled()
    expect(screen.getByText('每一組都要填人名和活動')).toBeInTheDocument()
  })

  it('allows saving once every group has a person and an activity', async () => {
    renderSheet({ event: null })
    await userEvent.click(screen.getByRole('button', { name: '分頭行動' }))

    await userEvent.type(screen.getByLabelText('第 1 組'), 'A')
    await userEvent.type(screen.getByLabelText('第 1 組活動'), '潛水')
    await userEvent.type(screen.getByLabelText('第 2 組'), 'B')
    await userEvent.type(screen.getByLabelText('第 2 組活動'), '購物')

    expect(screen.getByRole('button', { name: '儲存' })).toBeEnabled()
  })
```

注意：無成員時人名是 `<input>`，其 `placeholder` 為 `第 N 組` 但目前沒有 `aria-label`。
實作時要補上 `aria-label={`第 ${i + 1} 組`}`，測試才找得到。

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/__tests__/components/ForkCard.test.tsx src/__tests__/components/EventSheet.test.tsx`
Expected: FAIL — 找不到 `fork-groups`；儲存鈕在空白 fork 下仍可按。

- [ ] **Step 3: 寫最小實作**

`src/components/ForkCard.tsx`：把

```tsx
      <div className={`gap-2 pl-8 pr-3 pb-3 ${items.length > 2 ? 'flex flex-col' : 'flex'}`}>
```

換成

```tsx
      <div data-testid="fork-groups" className="flex flex-col gap-2 pl-8 pr-3 pb-3">
```

每一組加左側色條，取代原本靠底色區分的做法：

```tsx
          <div
            key={i}
            className={`border-l-[3px] border rounded-[8px] p-2 ${GROUP_STYLES[i % GROUP_STYLES.length]}`}
          >
            <span className={`inline-block text-[10px] font-bold mb-1 ${NAME_COLORS[i % NAME_COLORS.length]}`}>
              {item.person}
            </span>
```

`GROUP_STYLES` 各項追加對應的 `border-l-` 色（沿用該項既有的 border 色值，不新增色值）。

`src/components/EventSheet.tsx`：把 `titleMissing` 換成統一的阻擋原因

```ts
  const forkIncomplete = type === 'fork' && (
    forks.length < 2 || forks.some(f => !f.person.trim() || !f.title.trim())
  )
  const blockedReason = type === 'shared'
    ? (title.trim() ? null : '請輸入行程名稱')
    : (forkIncomplete ? '每一組都要填人名和活動' : null)
```

- `handleSave` 開頭 `if (blockedReason) return`。
- 儲存鈕 `disabled={saving || !!blockedReason}`。
- 共同行程原本的 `titleMissing` 錯誤提示改為 `{blockedReason && type === 'shared' && ...}`。
- 分頭行動區塊底部（「＋ 新增一組」之後）加

```tsx
              {blockedReason && type === 'fork' && (
                <p className="text-[11px] text-[#dc2626]">{blockedReason}</p>
              )}
```

- 人名 `<input>` 補 `aria-label={`第 ${i + 1} 組`}`。

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test`
Expected: PASS，測試數 +3。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "💄 style(fork): stack groups in one column and require complete groups"
```

---

## Task 15: 排序改單次 RPC 加樂觀更新

**Files:**
- Create: `supabase/migrations/011_reorder_events_rpc.sql`
- Modify: `src/lib/db.ts`（`reorderEvents`）、`src/components/DaySection.tsx`
- Test: `src/__tests__/lib/db.test.ts`、`src/__tests__/components/DaySection.test.tsx`

**Interfaces:**
- Consumes: `WriteResult`（Task 2）、`toast`（Task 3）、`events` prop（Task 8）
- Produces: `reorderEvents(dayId: string, orderedIds: string[]): Promise<WriteResult>`（簽章不變，改走 RPC）

- [ ] **Step 1: 先寫失敗的測試**

`src/__tests__/lib/db.test.ts` 的 `reorderEvents` 測試改寫：

```ts
describe('reorderEvents', () => {
  it('sends a single rpc call instead of one update per event', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })
    const result = await reorderEvents('d1', ['e2', 'e1'])
    expect(mockRpc).toHaveBeenCalledOnce()
    expect(mockRpc).toHaveBeenCalledWith('reorder_events_rpc', { p_day_id: 'd1', p_ids: ['e2', 'e1'] })
    expect(result).toEqual({ ok: true })
  })

  it('reports failure when the rpc errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'denied' } })
    expect(await reorderEvents('d1', ['e1'])).toEqual({ ok: false, error: 'denied' })
  })

  it('reports failure when the rpc returns false', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    expect(await reorderEvents('d1', ['e1'])).toEqual({ ok: false, error: 'REORDER_REJECTED' })
  })
})
```

`src/__tests__/components/DaySection.test.tsx` 追加：

```tsx
  it('shows a visible drag handle', () => {
    render(<DaySection day={day} tripId="t1" members={[]} events={[ev('a', '09:00')]} />)
    expect(screen.getByRole('button', { name: '拖曳排序' })).toBeVisible()
  })

```

dnd-kit 的拖曳在 jsdom 裡無法可靠模擬，所以把移動邏輯抽成純函式直接測：

```tsx
import { applyReorder } from '../../components/DaySection'

  it('applyReorder moves an item and reports the new order', () => {
    const list = [ev('a', '09:00'), ev('b', '10:00'), ev('c', '11:00')]
    expect(applyReorder(list, 'c', 'a').map(e => e.id)).toEqual(['c', 'a', 'b'])
  })

  it('applyReorder returns the original list when either id is unknown', () => {
    const list = [ev('a', '09:00')]
    expect(applyReorder(list, 'a', 'zzz')).toBe(list)
  })
```

該檔頂部加 `vi.mock('../../lib/toast', () => ({ toast: vi.fn() }))`。

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/__tests__/lib/db.test.ts src/__tests__/components/DaySection.test.tsx`
Expected: FAIL — `reorderEvents` 仍走 N 次 update；`applyReorder` 未匯出；拖曳把手不可見。

- [ ] **Step 3: 寫最小實作**

`supabase/migrations/011_reorder_events_rpc.sql`：

```sql
-- Reordering was N independent UPDATEs with no transaction: a partial failure
-- left the day in a half-sorted state. One statement, one transaction.
-- security invoker keeps the existing events RLS policies in force.

create or replace function public.reorder_events_rpc(p_day_id uuid, p_ids uuid[])
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_updated int;
begin
  update events e
  set sort_order = ord.position - 1
  from unnest(p_ids) with ordinality as ord(id, position)
  where e.id = ord.id
    and e.day_id = p_day_id;

  get diagnostics v_updated = row_count;
  return v_updated = array_length(p_ids, 1);
end;
$$;

revoke execute on function public.reorder_events_rpc(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_events_rpc(uuid, uuid[]) to authenticated;
```

套用（**不要用 `supabase db push`**，remote migration history 是空的）：

```bash
# Project ref: lyolbcmrqgxvrznudjsp
curl -sS -X POST \
  "https://api.supabase.com/v1/projects/lyolbcmrqgxvrznudjsp/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data "$(python3 -c 'import json,sys; print(json.dumps({"query": open("supabase/migrations/011_reorder_events_rpc.sql").read()}))')"
```

`src/lib/db.ts`：

```ts
export async function reorderEvents(dayId: string, orderedIds: string[]): Promise<WriteResult> {
  const { data, error } = await supabase.rpc('reorder_events_rpc', {
    p_day_id: dayId,
    p_ids: orderedIds,
  })
  if (error) return { ok: false, error: error.message }
  return data === true ? { ok: true } : { ok: false, error: 'REORDER_REJECTED' }
}
```

`src/components/DaySection.tsx`：

匯出純函式

```ts
/** Move `activeId` to `overId`'s position. Returns the input untouched when
 *  either id is not in the list. */
export function applyReorder(events: TripEvent[], activeId: string, overId: string): TripEvent[] {
  const from = events.findIndex((e) => e.id === activeId)
  const to = events.findIndex((e) => e.id === overId)
  if (from < 0 || to < 0) return events
  return arrayMove(events, from, to)
}
```

樂觀更新：

```ts
  const [pendingOrder, setPendingOrder] = useState<TripEvent[] | null>(null)
  const events = pendingOrder ?? incomingEvents

  // A realtime refetch is the authoritative answer; drop the local guess.
  useEffect(() => { setPendingOrder(null) }, [incomingEvents])

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const reordered = applyReorder(events, String(active.id), String(over.id))
    if (reordered === events) return

    setPendingOrder(reordered)
    const result = await reorderEvents(day.id, reordered.map((e) => e.id))
    if (!result.ok) {
      setPendingOrder(null)
      toast('排序沒有存成功,已還原')
    }
  }
```

`Props` 的 `events` 在解構時改名：`{ day, tripId, members, events: incomingEvents }`。

拖曳把手改成可見：把 `text-[#c7d2da]` 換成 `text-[#b0c4d0]`，並把 svg 包在
一個有底色的小方塊裡讓它看得出是可抓的區域：

```tsx
      <span
        {...attributes}
        {...listeners}
        role="button"
        aria-label="拖曳排序"
        className="absolute left-0 top-0 bottom-0 w-8 z-10 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
      >
        <span className="w-5 h-7 rounded-[5px] bg-[#f0f4f8] flex items-center justify-center text-[#8fa0b0]">
          <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
            <circle cx="3" cy="3" r="1.4" /><circle cx="8" cy="3" r="1.4" />
            <circle cx="3" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" />
            <circle cx="3" cy="13" r="1.4" /><circle cx="8" cy="13" r="1.4" />
          </svg>
        </span>
      </span>
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test && npx tsc -b`
Expected: PASS，測試數 +5。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "⚡️ perf(timeline): reorder in one transaction with optimistic rollback"
```

---

## Task 16: 安全區

**Files:**
- Modify: `index.html`、`src/pages/TripListPage.tsx`（FAB 位置）
- Test: 無自動化測試（純 CSS 與 meta，jsdom 量不到 `env()`）。以手動檢查清單驗證。

**Interfaces:**
- Consumes: 無
- Produces: 無

- [ ] **Step 1: 改 viewport meta**

`index.html`：

```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

沒有 `viewport-fit=cover` 時 `env(safe-area-inset-*)` 恆為 0，
`AccountSheet` 與 `ConfirmSheet` 既有的安全區 padding 全是死碼。

- [ ] **Step 2: 底部元素補安全區**

`TripNav` 的 `pb-[env(safe-area-inset-bottom)]` 已在 Task 12 加上。
`src/pages/TripListPage.tsx` 的 FAB `bottom-5` 改成
`bottom-[calc(1.25rem+env(safe-area-inset-bottom))]`。

- [ ] **Step 3: 手動驗證**

Run: `npm run build && npm run preview`

用 Chrome DevTools 的 iPhone 裝置模擬（含 device frame）逐項確認：

- [ ] 旅程列表：FAB 不被 home indicator 遮住
- [ ] 旅程頁：底部導覽整條可見，文字不被 home indicator 切到
- [ ] 帳號設定 sheet：底部按鈕不被遮住
- [ ] 刪除確認 sheet：底部按鈕不被遮住
- [ ] 安裝提示：不與底部導覽重疊

- [ ] **Step 4: 跑測試確認沒壞**

Run: `npm test && npm run build`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "🐛 fix(pwa): honour the safe area on notched devices"
```

---

## Task 17: 顏色 token 化

**Files:**
- Modify: `src/index.css`、全部 `src/components/*.tsx` 與 `src/pages/*.tsx`
- Test: 靠既有測試回歸；額外加一條 grep 檢查

**Interfaces:**
- Consumes: 無
- Produces: `src/index.css` 的 `@theme` 涵蓋全部使用中的色值

- [ ] **Step 1: 盤點色值**

Run:

```bash
grep -roh -e '#[0-9a-fA-F]\{6\}' src | sort | uniq -c | sort -rn
```

把每個色值對應到 token 名。既有 token 先沿用，缺的按用途命名（例如
`--color-text-strong: #1a2530`、`--color-bg-accent: #e3f1f9`、
`--color-ok: #15803d`、`--color-muted: #8fa0b0`）。
**不得引入任何新色值**，只是替原有色值命名。

- [ ] **Step 2: 補齊 `@theme`**

`src/index.css` 的 `@theme` 區塊補上盤點出來的全部 token。
`:focus-visible` 與 `body` 的硬編色也換成 `var(--color-*)`。

- [ ] **Step 3: 機械替換**

逐檔把 `text-[#1a2530]` → `text-text-strong`、`bg-[#0077b6]` → `bg-primary`
這類形式換掉。Tailwind 4 會把 `@theme` 的 `--color-x` 暴露成 `text-x` / `bg-x` /
`border-x`。SVG 的 `stroke="#..."` 屬性與 `GROUP_STYLES` / `NAME_COLORS` /
`FALLBACK_COLORS` 常數陣列同樣處理。

一次只改一個檔案，改完就跑 `npx vitest run` 相關測試，避免一次爆掉。

- [ ] **Step 4: 驗證**

Run:

```bash
npm test && npx tsc -b && npm run build
grep -rn -e '#[0-9a-fA-F]\{6\}' src/components src/pages | grep -v __tests__ | grep -v Logo.tsx
```

Expected: 測試與 build PASS，grep 無結果。唯一允許保留 hex 的是
`src/components/Logo.tsx`（品牌圖形的 `#0077b6`，屬於資產而非樣式）。

視覺回歸：`npm run preview`，逐頁比對每個畫面與改動前一致（色值未變，只換寫法）。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "💄 style(theme): replace hardcoded hex with theme tokens"
```

---

## 完成檢查

全部 task 結束後跑一次：

```bash
npm test                    # 全部綠燈，測試數應為 93 + 約 45 = 約 138
npx tsc -b                  # 無型別錯誤
npm run lint                # 無 lint 錯誤
npm run build               # build 成功
grep -rn -e 'window\.alert' -e 'window\.confirm' -e 'window\.prompt' src --exclude-dir=__tests__   # 無結果
grep -rn -e '#[0-9a-fA-F]\{6\}' src/components src/pages | grep -v __tests__ | grep -v Logo.tsx    # 無結果
grep -rn 'useEvents' src                                                                            # 無結果
```

手動走一次新使用者流程（`npm run preview`，用無痕視窗）：

- [ ] 登入 → 空狀態有「建立第一個旅程」按鈕
- [ ] 建立旅程 → 日期已預填今天到今天+2
- [ ] 落在時間軸 → 頂端出現邀請卡
- [ ] 加一個行程 → 型別切換下方有說明文字；填地點後卡片出現「導航」
- [ ] 分頭行動 → 沒填完儲存鈕是停用的，且說明缺什麼
- [ ] 拖曳排序 → 把手看得見，放手立刻換位
- [ ] 齒輪 → 設定頁（含旅伴區塊），返回鍵回旅程
- [ ] 底部只有「今天」「行程」兩個 tab
- [ ] 刪除旅程 → sheet 內輸入名稱確認，不是原生 prompt
- [ ] 開飛航模式 → 出現「離線,只能檢視」；關掉後警告消失
