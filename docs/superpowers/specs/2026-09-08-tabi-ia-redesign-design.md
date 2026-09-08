# Tabi 資訊架構重整與正確性修復

日期：2026-09-08
狀態：已核可，待實作

## 背景

Tabi 是一個多人共編的旅遊行程 PWA（React 18 + Vite + Supabase + Tailwind 4）。
全面檢視後找出 28 項問題，集中在四類：資訊架構重複、新使用者無引導、
介面顯示錯誤資訊、以及互動品質。本文件定義修復範圍與設計。

## 定位

**當天執行為主。** 旅行當天打開的次數遠多於出發前規劃，因此介面的第一屏
必須回答「現在該在哪、下一站幾點」。事前規劃是次要情境，沿用既有時間軸。

## 範圍

只修不刪：不移除任何既有功能，不新增功能。唯一例外是地圖導航連結
（把既有的 `location` 純文字串成 Google Maps 查詢 URL，約 3 行），
因為它是「當天執行」定位的核心動作。

明確排除：深色模式、離線寫入佇列、花費／訂房紀錄、行程負責人、
主揪轉移、fork 一組多人。

---

## 1. 導覽與資訊架構

### 現況問題

- `MembersPage`（`src/pages/MembersPage.tsx:31`）與 `SettingsPage`
  （`src/pages/SettingsPage.tsx:143`）渲染同一個 `MembersSection`，
  同一功能兩個入口。
- 底部三個 tab 中兩個是設定類，永久佔用螢幕空間。
- `MembersPage` 無返回鍵；`SettingsPage` 同時有返回鍵與 active 的底部導覽。

### 設計

底部導覽縮為兩項：

| Tab | 行為 |
|---|---|
| 今天 | 捲動到時間軸頂部的「現在」區塊 |
| 行程 | 捲動到時間軸最頂 |

- 刪除 `src/pages/MembersPage.tsx` 與 `/trips/:tripId/members` 路由。
  旅伴功能完整保留在設定頁的 `MembersSection`。
- 設定頁改由 header 右上的齒輪進入，是唯一有返回鍵的頁面，且不顯示底部導覽。
- Header 的頭像堆疊點擊後同樣進入設定頁（旅伴區塊）。

三種返回行為（時間軸的左上箭頭回列表、設定的返回、旅伴頁沒有）統一為：
列表 → 旅程（左上箭頭回列表）、旅程 → 設定（返回鍵回旅程）。

---

## 2. 「現在」區塊

採用「行程頁頂部區塊」而非獨立頁面。理由：不新增頁面、不需要為
「旅程未開始／進行中／已結束」設計三份空狀態、行程只渲染一次因此
不會有兩份不同步的清單。

### 顯示規則

區塊釘在時間軸最上方，只在 `tripStatus === 'ongoing'` 時渲染：

- **現在進行中**：`time_start <= now < time_end` 的行程，完整卡片。
  同時符合的多筆全部列出。
- **接下來**：今天剩餘 `time_start > now` 的行程，最多 3 筆，精簡單行
  （時間 · 名稱 · 地點）。
- 今天已無未來行程時，顯示明天第一筆並標示「明天」。
- 沒有「已過去」收合區；往下捲就是完整時間軸，不重複渲染。

`tripStatus !== 'ongoing'` 時區塊不渲染，畫面退回目前的時間軸，
底部「今天」tab 停用（`disabled`，非隱藏，避免版面跳動）。

### 時間推進

以每分鐘一次的 tick 驅動重算（`setInterval` 60s，元件卸載時清除）。
同一個 tick 也驅動現在時間線（見 §3）。

---

## 3. 正確性修復

這些是介面顯示錯誤資訊的項目，優先於任何外觀調整。

### 3.1 同步狀態

`src/hooks/useSyncStatus.ts` 目前只讀 `navigator.onLine` 就宣告「已同步」，
realtime websocket 斷線時照樣顯示綠燈。

改為由實際的 Supabase channel 狀態驅動：`subscribe()` 的回呼提供
`SUBSCRIBED` / `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED`。

- `SUBSCRIBED` → 已連線，**不顯示任何徽章**
- `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED` → 顯示「連線中斷，重新整理」
- `navigator.onLine === false` → 顯示「離線，只能檢視」

措辭必須誠實：目前所有寫入都直打 Supabase，離線無法編輯，因此不能用
暗示可離線作業的「離線模式」。

### 3.2 假的「已儲存」

`db.ts` 的 `updateTrip` 不檢查 error，`SettingsPage.tsx:42` 卻無條件
閃「已儲存」。`updateTrip` 改為回傳 `{ ok, error }`，呼叫端只在 `ok`
時顯示 `SavedBadge`，失敗顯示錯誤訊息（不用 `alert`，見 §4）。

同一問題檢查所有寫入函式：`updateDayLabel`、`updateEvent`、`deleteEvent`
目前都吞掉 error，一律改為回傳 `{ ok: boolean; error?: string }`。
呼叫端在失敗時以 Toast 告知（見 §4），成功時維持現有行為。

### 3.3 旅程列表排序

`db.ts:118` 用 `start_date` 降冪，導致最遠的未來旅程排最上、最近要出發的
排最下。改為在客戶端分組後各自排序：

- 進行中：`start_date` 升冪
- 即將出發：`start_date` 升冪（快出發的在最上）
- 已結束：`end_date` 降冪（最近結束的在最上）

### 3.4 現在時間線

`DaySection.tsx:106` 用 `events.filter(e => e.time_start <= nowTime).length`
當插入索引，但清單依 `sort_order` 排列，拖曳後與時間順序不一致，時間線
就指錯位置。此外 `nowTime` 只在 render 時計算，不會自己走。

改為：找出「`time_start <= now` 的行程中，在清單裡位置最後的那一筆」，
把時間線插在它後面；沒有任何一筆符合時就插在最前。時間值由 §2 的
每分鐘 tick 提供。

### 3.5 空時間顯示

`EventCard.tsx:22` 無條件輸出 `{time_start} – {time_end}`，兩者皆空時
顯示孤零零的「–」。改為兩者皆空就不渲染該行；只有其中一個時只顯示那一個。
`EventDetailSheet` 已有此保護，行為對齊。

### 3.6 自動捲動

`TimelinePage.tsx:28-70` 目前用最多 10 次、每次 300ms 的 DOM 輪詢找目標，
並捲到 `lastPast`（可能是幾小時前就結束的行程）。

改為：等 `days` 與 events 資料就緒後直接計算目標 id，捲到「還沒結束的
第一個行程」（`time_end > now`，退而求其次為今天第一筆）。移除輪詢。
`tripStatus !== 'ongoing'` 時不自動捲動。

---

## 4. 對話框系統

15 處 `window.alert` / `confirm` / `prompt`（`MembersSection.tsx:45`、
`EventSheet.tsx:80,104,136,144,150`、`AccountSheet.tsx:30`、
`SettingsPage.tsx:45,66,71,73,81,84,91,93`）與 app 的 BottomSheet
語言不一致，在 standalone PWA 中看起來像壞掉。

新增兩個元件：

- **`ConfirmSheet`**（約 40 行，包裝既有 `BottomSheet`）：標題、說明、
  確認／取消。`destructive` 屬性讓確認鈕轉紅。可選 `requireTypedText`
  屬性提供輸入框，用於刪除旅程時輸入旅程名稱確認。
- **`Toast`**（約 30 行）：短暫的頂部訊息，用於錯誤與非阻斷回饋，
  `role="status"`，3 秒自動消失。

全部 15 處替換完畢，`window.alert/confirm/prompt` 在 `src/` 中歸零
（以 grep 驗證）。

---

## 5. 上手引導

- **空狀態**（`TripListPage.tsx:110`）：目前只有一行文字，唯一入口是右下角
  浮動 `+`。加入主要按鈕「建立第一個旅程」。FAB 只在已有旅程時顯示。
- **日期預設**（`NewTripPage.tsx:11-13`）：開始日期預設今天，結束日期
  預設今天 +2 天，使用者可改。
- **邀請提示**：旅程只有一位成員時，顯示一張提示卡
  「把連結傳給旅伴，一起排行程」＋分享鈕（重用 `MembersSection` 的
  `handleShare`，抽成 `useInviteLink` hook）。成員數 > 1 即自動消失，
  不需要記住已略過狀態。它與 §2 的「現在」區塊同時存在時，邀請卡在上、
  「現在」區塊在下。
- **分頭行動說明**：`EventSheet` 的型別切換下方加一行說明文字
  「同一時段大家分開行動時使用，各組的安排分開記錄」。

### InstallPrompt

- 目前 `bottom-20` 在旅程頁與底部導覽重疊 → 改為以底部導覽高度計算偏移。
- 略過不持久化，每次開都跳 → 略過後寫入 `localStorage`，30 天內不再顯示。

---

## 6. 分頭行動

保留功能，修正可用性：

- **版面**：`ForkCard` 目前在 2 組時橫向並排（`ForkCard.tsx:26`），
  手機上文字嚴重擠壓。改為一律單欄垂直堆疊，每組左側色條＋人名 chip。
- **驗證**：目前只有共同行程檢查標題，fork 可以完全空白儲存。
  改為要求至少 2 組，且每組必須有人名與活動名稱，未滿足時儲存鈕停用
  並顯示缺什麼。
- 無成員時的純文字輸入維持現狀。

---

## 7. 底層

### 7.1 Realtime channel 收斂

目前每個 `DaySection` 各自呼叫 `useEvents` → `subscribeToEvents`，
每天一條 channel。10 天的旅程會開 1（trip）+ 1（days）+ 10（events）
= 12 條 channel。

`events` 表已有 `trip_id` 欄位（`supabase/migrations/001_schema.sql:30`），
因此改為整趟一條 channel：`subscribeToTripEvents(tripId, cb)` 一次抓回
全部行程，在記憶體依 `day_id` 分組。10 天旅程從 12 條降為 3 條。

分發方式：`useTrip` 一併回傳 `eventsByDay: Record<string, TripEvent[]>`，
`TimelinePage` 以 prop 往下傳給 `DaySection`（`DaySection` 已經從 prop
接收 `day` 與 `members`，多一個 prop 不需要 context）。刪除
`src/hooks/useEvents.ts` 與 `subscribeToEvents`。localStorage 快取的
key 從每日一筆（`sb_events_<trip>_<day>`）改為每趟一筆
（`sb_events_<trip>`）；舊 key 不做遷移，快取失效一次即可。

這同時是 §2「現在」區塊的前提——它需要跨日查詢行程。

### 7.2 拖曳排序

`reorderEvents` 目前併發送出 N 個獨立 UPDATE，無交易、無樂觀更新，
拖完要等 realtime 推回才更新畫面。

- 加樂觀更新：先更新本地順序，寫入失敗則回滾並以 Toast 告知。
- 寫入改為單一 RPC `reorder_events_rpc(p_day_id, p_ids uuid[])`，
  在一個交易內完成，新增 migration `011_reorder_events_rpc.sql`。
- 拖曳把手（`DaySection.tsx:47`）目前是卡片左側 8px 的隱形條，
  改為可見的點狀圖示。

### 7.3 安全區與樣式

- `index.html` 的 viewport 加 `viewport-fit=cover`。目前沒有它，
  `env(safe-area-inset-bottom)` 恆為 0，`AccountSheet` 既有的安全區
  padding 是死碼，且 iPhone standalone 模式下底部導覽會被 home indicator 壓住。
- 底部導覽補 `pb-[env(safe-area-inset-bottom)]`。
- `src/index.css` 已定義 `@theme` token，但元件中是 219 處硬編 hex
  （34 種色值），token 使用次數為 0。做純機械替換：不改任何色值，
  只把 hex 換成 token。34 種色值中未涵蓋於現有 token 的，補進 `@theme`。

### 7.4 無障礙

- `EventCard.tsx:15` 與 `ForkCard.tsx:22` 的 `aria-label="查看行程"`
  蓋掉整張卡片內容，螢幕閱讀器讀不到標題與時間。移除該屬性，
  讓卡片內容自然被讀出。

### 7.5 清理

`db.ts` 中的死參數：`updateDayLabel(_tripId)`、`subscribeToEvents(_tripId)`、
`updateEvent(_tripId, _dayId)`、`deleteEvent(_tripId, _dayId)`、
`reorderEvents(_tripId)`。移除並更新所有呼叫端與測試。

---

## 8. 地圖導航（唯一新增）

`EventCard` 與 `EventDetailSheet` 在 `location` 非空時顯示「導航」連結，
指向 `https://www.google.com/maps/search/?api=1&query=` +
`encodeURIComponent(location)`，`target="_blank" rel="noopener noreferrer"`。
不做地圖 SDK、不做座標、不做路線規劃。

---

## 測試

既有 93 個測試必須全部維持綠燈。以下新增覆蓋：

| 對象 | 驗證 |
|---|---|
| `useSyncStatus` | channel 狀態 → 徽章狀態的對應，含 offline |
| 現在時間線 | 拖曳後順序與時間不一致時仍插對位置 |
| 自動捲動 | 選中「還沒結束的第一個行程」而非最後開始的 |
| 「現在」區塊 | ongoing 才渲染；今天無剩餘行程時顯示明天第一筆 |
| 旅程列表排序 | 三組各自的排序方向 |
| `ConfirmSheet` | 確認／取消／需輸入文字三種路徑 |
| Toast | 顯示與自動消失 |
| fork 驗證 | 缺人名或缺活動時儲存鈕停用 |
| 拖曳樂觀更新 | 寫入失敗時回滾 |
| `EventCard` | 時間皆空時不渲染時間行；有 location 時出現導航連結 |
| grep 檢查 | `src/` 內無 `window.alert/confirm/prompt` |

## 影響範圍

- 刪除：`src/pages/MembersPage.tsx`
- 新增：`src/components/ConfirmSheet.tsx`、`src/components/Toast.tsx`、
  `src/components/NowSection.tsx`、`src/hooks/useInviteLink.ts`、
  `src/hooks/useNow.ts`、`supabase/migrations/011_reorder_events_rpc.sql`
- 修改：約 18 個既有檔案
