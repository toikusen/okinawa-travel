# 沖繩旅遊行程 PWA — 設計規格

## 概覽

給 Sei 與同事共用的沖繩旅遊行程管理 PWA。支援即時同步、離線查看、分岔行程（部分時段兩人分開活動）。

**旅程日期：** 2025/06/11–06/15（5 天）

---

## 技術架構

| 層級 | 技術選擇 |
|------|----------|
| 前端框架 | React 19 + TypeScript + Vite |
| 樣式 | Tailwind CSS v4 |
| PWA | vite-plugin-pwa + Workbox |
| 認證 | Firebase Auth（Google Sign-In）|
| 資料庫 | Firebase Firestore（含 offline persistence）|
| 狀態管理 | Firestore `onSnapshot` 即時監聽（無額外套件）|

**離線策略：**
- Static assets：Cache First（App shell 永遠從快取載入）
- Firestore 資料：SDK 內建 IndexedDB 快取，離線可讀寫，恢復網路後自動合併

---

## 資料模型

```
trips/{tripId}
  ├── name: string               // "沖繩 2025"
  ├── members: string[]          // ["sei@gmail.com", "colleague@gmail.com"]
  └── days/{dayId}
        ├── date: string         // "2025-06-12"
        ├── label: string        // "沖繩北部"
        ├── sort_order: number
        └── events/{eventId}
              ├── type: "shared" | "fork"
              ├── title: string
              ├── time_start: string   // "12:00"
              ├── time_end: string     // "15:00"
              ├── location: string
              ├── notes: string
              ├── sort_order: number
              └── fork_items?: [       // 僅 type=fork 時存在
                    { person: string, title: string, location: string, notes: string },
                    { person: string, title: string, location: string, notes: string }
                  ]
```

**設計決策：**
- `tripId` 同時作為邀請連結的識別碼（`/join/{tripId}`）
- fork 的兩個分支內嵌於同一 document，不拆子集合（規模小，無需正規化）
- Firestore Security Rules：`members` 陣列控制讀寫，非成員無法存取

---

## UI 結構

### 頁面組成

| 畫面 | 說明 |
|------|------|
| `/login` | Google 登入頁，未登入時跳轉 |
| `/` | 主畫面（垂直時間軸）|
| `/join/:tripId` | 邀請連結入口，登入後自動加入旅程 |
| `/settings` | 設定頁 |

### 主畫面（時間軸）

- **頂部 Header**：旅程名稱、同步狀態指示燈（綠/黃/紅）、用戶頭像
- **內容區**：垂直捲動，以日期為分隔區塊
  - 日期標題列：日期、標籤、新增按鈕（＋）
  - 行程卡片（shared）：時間、名稱、地點、右箭頭
  - 行程卡片（fork）：藍色左邊框，顯示兩人分岔雙欄
- **底部導航**：行程（🗓）/ 設定（⚙️）

### 行程卡片 — 分岔樣式

```
┌─────────────────────────────────┐
│ ↕ 分岔行程 · 15:30–17:30        │  ← 藍色左邊框
├────────────────┬────────────────┤
│ Sei            │ 同事           │
│ 參加活動       │ 浦添 PARCO     │
└────────────────┴────────────────┘
```

### 編輯表單（Bottom Sheet）

從底部滑上，覆蓋主畫面下半部。包含：
- 共同 / 分岔 切換 toggle
- 名稱、開始時間、結束時間、地點、備註
- 分岔模式：兩組欄位分別填寫
- 儲存 / 刪除按鈕

---

## 功能流程

### 登入 & 加入旅程

1. 開啟 app → 未登入 → `/login`
2. Google 登入完成
3. **建立旅程**：首次使用者建立新 trip，複製邀請連結（`/join/{tripId}`）傳給同事
4. **加入旅程**：同事點連結 → 登入 → 自動寫入 `members`，跳轉至主畫面

### 行程操作

- **查看**：主畫面垂直捲動瀏覽全程行程
- **新增**：點日期旁 ＋ → bottom sheet（預設共同模式）
- **編輯**：點任意行程卡片 → bottom sheet 展開
- **切換類型**：編輯時 toggle 共同 ↔ 分岔
- **排序**：長按卡片拖曳（同日內重新排序，更新 `sort_order`）
- **刪除**：編輯表單內刪除按鈕

### 同步狀態

| 狀態 | 指示燈 | 文字 |
|------|--------|------|
| 已同步 | 綠點 | 已同步 |
| 同步中 | 黃點（閃爍）| 同步中... |
| 離線 | 紅點 | 離線模式 |

### 設定頁

- 旅程名稱編輯
- 複製邀請連結
- 登出

---

## PWA 規格

- **安裝提示**：首次開啟顯示「加入主畫面」banner
- **顯示模式**：`standalone`（全螢幕，無瀏覽器 UI）
- **Manifest**：名稱「沖繩旅遊」、主題色 `#0077b6`、白色背景
- **Service Worker**：vite-plugin-pwa 自動產生，Workbox InjectManifest 策略

---

## 設計系統

- **主色**：`#0077b6`（沖繩海洋藍）
- **背景**：`#f0f4f8`
- **卡片背景**：`#ffffff`
- **邊框**：`#e8edf2`
- **次要文字**：`#5a7a8a`
- **標籤文字**：`#8fa0b0`
- **危險色**：`#dc2626`
- **字型**：系統預設（`-apple-system, BlinkMacSystemFont, 'Segoe UI'`）
- **圓角**：卡片 `12px`，按鈕 `10px`，標籤 `8px`

---

## 範圍外（Out of Scope）

- 地圖整合
- 推播通知
- 多語言支援
- 超過 2 位成員
- 照片上傳
- 行程匯出（PDF / ICS）
