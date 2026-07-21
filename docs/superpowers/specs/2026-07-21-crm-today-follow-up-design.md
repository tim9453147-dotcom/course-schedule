# 名單「今日跟進」智慧清單（先找誰）— 設計稿

日期：2026-07-21
主題：名單管理優化 — 每天一打開就知道「今天先找誰」

## 背景與目標

現有名單管理（`/crm`）已具備：inline 編輯、破題二元狀態、可自訂進度階段、跟進頻率 →
自動算下次跟進日（`server/utils/followup.ts`）、逾期徽章、Done 勾選＝今天已跟進、跟進紀錄時間軸、
「每日任務」四區塊板（ProspectWorksheet）。名單為每位使用者各自私有（`contacts.userId`，
查詢一律 `ownedBy(...)` 過濾）。

**痛點**：使用者仍要自己掃整張表、判斷今天該聯絡誰。逾期只有徽章、要人工過濾；
「該優先花力氣的人」沒有排序。

**目標**：在既有「每人各自的總名單」之上，新增一個「今日跟進」清單，
用透明的熱度分數排序，讓使用者一登入就知道**今天先找誰**。

## 範圍

- **A（本 spec）**：純站內功能，資料範圍完全不變（每位使用者只看自己的名單，超級管理員看 `userId` 為 NULL 那批）。
- 熱度公式抽成 `shared/utils` 純函式（**做法 3**），現在只在前端使用；不動資料庫、不加 API。

### 非目標（明確排除）

- **不碰 LINE**：不做任何推播、不綁定個人 LINE、不動現有群組通知。
- 每日早上 LINE 私訊提醒（原 B 案）需要「每位使用者各自綁定個人 LINE `userId`」，
  留作獨立後續 spec。本 spec 把熱度公式放在 `shared/utils`，屆時後端 cron 可直接重用同一支函式。
- 不做跨使用者彙整、不新增資料表或欄位、不做名單匯入/標籤/看板（其他優化項）。

## 做法（做法 3：shared 純函式）

名單頁已一次抓齊使用者自己的所有名單（`useFetch('/api/contacts')`）。熱度分數與入列判斷
就在前端計算與排序，符合 codebase 既有慣例（`shared/utils/followup.ts`、`seasons.ts`、`aiPrompt.ts`
皆為前後端自動匯入的純邏輯）。未來做 LINE 推播時，後端 cron 直接 import 同一支公式，不必重寫。

## 熱度公式（`shared/utils/leadScore.ts`）

單一真相來源，純函式、無副作用、不依賴 DOM 或 `event`。

### 入列判斷 `isTodayFollowUp(contact, today)`

符合任一即列入「今日跟進」（`today` 為 `YYYY-MM-DD`，由呼叫端傳入，維持純函式）：

1. **逾期**：`nextFollowUp` 有值且 `< today`
2. **今天到期**：`nextFollowUp === today`
3. **待啟動**：設了 `followUpFreq`（非「暫停」）但從沒跟進過（`lastFollowUp` 為空）

### 分數 `leadScore(contact, today)`（越高越前）

透明加權，每項都能對應到畫面上一句理由：

| 因素 | 加分 | 用意 |
|---|---|---|
| 逾期天數 | `min(逾期天數, 30) × 3` | 越拖越前，30 天上限避免超舊名單洗版 |
| 今天到期 | +40 | 今天約好的優先 |
| 待啟動（有頻率沒跟過） | +35 | 提醒把還沒開始的名單啟動 |
| 跟進頻率 | 一週+20／兩週+14／一月+8／一季+4／半年+2／暫停或未設 0 | 越高頻越該顧 |
| 進度階段數 | 每完成一階 +5 | 越接近成交越把握 |
| 已破題 | +10 | 溫度較高 |

（權重為常數、集中在此檔頂部，方便日後調整。）

### 主要理由 `topReason(contact, today)`

回傳畫面主 chip 用的理由物件，優先序：`逾期 N 天`（error 色）→ `今天到期` → `待啟動`。
分數數字另以小字呈現。

## 資料流與架構

- **無新後端**：`TodayFollowUp.vue` 重用現有 `GET /api/contacts`（已 `ownedBy` 過濾）與 `GET /api/contact-stages`。
- 前端流程：抓名單 → `contacts.filter(isTodayFollowUp) → sort by leadScore desc` → 卡片列表。
- 快捷動作沿用既有端點：
  - 「今天已跟進」＝ `POST /api/contacts/:id/logs`（date=今天），與 ContactList 的 `toggleDone` 同一行為；
    勾完該人 `lastFollowUp/nextFollowUp` 由後端回算，重新整理後即離開今日清單。
  - 「明細」＝開 `ContactDetailModal`。
- 日期一律用既有 `todayStr()`（`app/utils`）取得，傳入純函式，避免在 util 內呼叫 `Date.now()`。

## UI / 元件

- `app/pages/crm.vue`：分頁由「每日任務／總名單」→ 前面加第三分頁 **「今日跟進」並設為預設**
  （`default-value` 改為新分頁的 value），一登入即見今天該做什麼。
- 新元件 `app/components/TodayFollowUp.vue`（同 `ContactList.vue`／`ProspectWorksheet.vue` 命名慣例）。
- **卡片列表**（手機友善）：每張卡＝一個人，顯示
  - 姓名、位置
  - 主要理由 chip（`逾期 N 天`／`今天到期`／`待啟動`）＋ 小字熱度分
  - 上次跟進（相對時間 `timeAgo`）
  - 右側快捷：勾「今天已跟進」（`toggleDone`）、「明細」（`ContactDetailModal`）
- 頂部一句彙整：「今天有 N 位待跟進」。
- 空狀態：「今天沒有待跟進的名單 🎉」。

## 邊界情況與錯誤處理

- 名單為 0 或今日清單為 0 → 顯示空狀態，不報錯。
- `nextFollowUp`／`lastFollowUp` 為空、`followUpFreq` 為「暫停」→ 依入列規則自然排除。
- 勾「今天已跟進」失敗 → 沿用 ContactList 既有模式：`notify.error` + `refresh` 還原。
- 樂觀更新：勾完即時把該卡移出清單，API 失敗再還原。

## 測試 / 驗證

- 無自動化測試框架（同專案現況）。以 `shared/utils/leadScore.ts` 的純函式特性，
  可用少量手寫案例在 dev console 驗證分數/入列（逾期、今天到期、待啟動、暫停、無頻率各一）。
- 端到端沿用專案既有方式：`bun dev` + headless Chrome 登入後檢查「今日跟進」分頁排序與勾選行為。
- 交付前跑 `just typecheck`、`just lint`。

## 影響檔案

- 新增：`shared/utils/leadScore.ts`
- 新增：`app/components/TodayFollowUp.vue`
- 修改：`app/pages/crm.vue`（加分頁、設預設）
- 不動：資料庫 schema、`server/**`（無新 API）
