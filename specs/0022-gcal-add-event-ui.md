# 0022 — Google Calendar 式的新增／檢視事件 UI

## 目標

把課表（`/`, `app/pages/index.vue`）的「新增 / 檢視事件」互動重新設計成 **Google Calendar 兩段式體驗**：

- **點日曆空白格** → 跳出**快速建立彈窗**（錨定點擊處），只需標題＋時間即可存。
- **點既有課程/活動** → 跳出**唯讀詳情彈窗**（錨定點擊處），上面有編輯/刪除按鈕。
- **深度編輯** → 沿用現有的完整 `UModal`，由快速彈窗的「更多選項」或詳情彈窗的「編輯」進入。

目標是降低「新增一筆」的操作成本（現在點一下就直接開一個滿版欄位的大 modal），並讓「只是想看某堂課資訊」不必進入編輯表單。

## 現況（重構起點）

`app/pages/index.vue`（約 1095 行）目前：

- `onDateClick`：`!canEdit` 直接 return；否則 `resetForm()` → `mode='create'` → 開 `open`（完整 `UModal`）。
- `onEventClick`：`!canEdit` 直接 return；否則把 course/event 預填進 `form` → `mode='edit'` → 開 `open`。
- 完整 `UModal`（`v-model:open="open"`）含全部欄位，儲存走 `save()`，刪除走 `remove()`，每週重複改動時先問修改範圍（`scopeOpen`）。

本 spec **不改** `save()` / `remove()` / 修改範圍（`scopeOpen`）/ 匯入（`importOpen`）/ 拖曳（`onEventDrop`）的既有邏輯，只改**進入點**與**新增兩個浮動面板**。

## 三個層級

### 1. 快速建立彈窗（`QuickCreatePopover`）

觸發：`onDateClick`，且 `canEdit` 為真（無編輯權限者點空白格不反應，維持現況）。

內容：

- 頂部：唯讀顯示點選日期，如「7/11 週五」。
- **標題**輸入框（自動聚焦）。
- 一行**時間**：預設「全天」；一個切換（toggle / 連結）切成「設定時間」後顯示精簡的起訖時／分下拉（重用現有 `hourItems` / `minuteItems` 與 `startHour/startMinute/endHour/endMinute` 模型）。
- 動作列：`更多選項`（左）、`儲存`（右）。

隱含預設（不在彈窗顯示）：`kind='activity'`、`repeat='none'`、`classroom=` 目前分頁、`color=KIND_DEFAULT_COLOR.activity`、`location=` 目前教室名稱（沿用 `resetForm()` 的預設）。

行為：

- 開啟時等同 `resetForm()`＋把 `form.date` 設成點選日，`mode='create'`；快速彈窗與完整 modal **共用同一個 `form`**，故「更多選項」不需搬資料。
- **`儲存`**：標題必填（空白則沿用現有 `notify` 提示、不關閉）。以 `form` 內容 `POST /api/events`（單次活動），成功後 `refreshEvents()`＋toast，關閉彈窗。等同現有 `save()` 在 `repeat==='none' && mode==='create'` 的分支——**實作上直接呼叫既有 `save()`**，避免重複邏輯。
- **`更多選項`**：關閉快速彈窗、開啟完整 `UModal`（`open=true`）。因共用 `form`，已輸入的標題/時間自動帶入。

### 2. 詳情彈窗（`EventDetailPopover`，唯讀）

觸發：`onEventClick`（**不論是否有編輯權限都會開**——唯讀者也能看資訊）。

內容（唯讀）：

- 顏色點＋標題。
- 日期／週幾；時間（`HH:MM–HH:MM`）或「全天」。
- 重複資訊：每週課顯示「每週X」，單次活動顯示該日期。
- 地點（有才顯示）。
- 角色（僅 `kind==='course'` 且有值才顯示：主持／分享／總結／PM）。
- 備註（有才顯示）。

動作列（**僅 `canEdit` 時顯示**）：`編輯`、`刪除`。

- **`編輯`**：關閉詳情彈窗，套用現有 `onEventClick` 的預填邏輯把該筆帶進 `form`（`mode='edit'`），開完整 `UModal`。
- **`刪除`**：沿用現有 `remove()`（含每週課的處理）。

實作重點：目前 `onEventClick` 同時做「預填 `form`」與「開 modal」。重構後拆成兩步——`onEventClick` 只計算並記住被點的來源/id/occDate 與一份**唯讀顯示資料**、開詳情彈窗；使用者按「編輯」時才把資料填進 `form` 並開完整 modal。

### 3. 完整編輯視窗（沿用現有 `UModal`）

不變。只是進入點改為由快速彈窗（更多選項）或詳情彈窗（編輯）觸發，不再由 `onDateClick` / `onEventClick` 直接開。

## 錨定與 RWD

- 用一個 **virtual anchor**（`getBoundingClientRect` 回傳點擊座標，取自 `info.jsEvent.clientX/clientY`）給浮動面板定位；由底層 Floating UI 自動翻轉/避邊（flip/shift）。
- **先驗證** Nuxt UI `UPopover` 是否支援 virtual/reference 錨點的參數；若 wrapper 未直接暴露，退路是以 `@floating-ui/vue` 的 `useFloating`＋自訂輕量面板（`Teleport` 到 body、`v-on-click-outside` 關閉）實作，樣式沿用 Nuxt UI 的 token（`bg-default`、`border-default`、`ring`、圓角、陰影）以求一致。
- 窄螢幕（`< 640px`）退化為**置中/底部小彈窗**，避免手機上錨定跑版；用 `useMediaQuery('(max-width: 639px)')` 判斷，窄螢幕忽略 anchor 改用置中定位（或直接 `UModal` 小尺寸）。

## 權限行為

| 動作 | 無編輯權限 | 有 `calendar` 編輯權限 / 超級管理員 |
|---|---|---|
| 點空白格 | 無反應（同現況） | 開快速建立彈窗 |
| 點既有事件 | 開詳情彈窗（唯讀，無編輯/刪除鈕） | 開詳情彈窗（含編輯/刪除鈕） |

前端只是外觀；後端仍由 `requirePage(event, 'calendar')` 把關（不變）。

## 檔案異動

- `app/pages/index.vue`：改 `onDateClick` / `onEventClick`；新增快速彈窗與詳情彈窗的狀態（開關 + anchor + 詳情顯示資料）與掛載；`save()` / `remove()` / `scopeOpen` / 匯入 / 拖曳不動。
- 新增 `app/components/QuickCreatePopover.vue`、`app/components/EventDetailPopover.vue`（把面板 UI 抽出，縮小 `index.vue`）。若錨定走自建路線，另抽一個 `app/composables/useAnchoredFloating.ts` 共用定位邏輯。
- 需要時 `app/utils/schedule.ts` 補一個把 course/event 轉成「詳情顯示資料」的小工具（純資料整形，方便兩處重用與測試）。

## 驗證

無自動化測試，沿用 CLAUDE.md 的 headless Chrome / Playwright 對 `bun dev` 手動驗證：

1. 有編輯權限：點空白格 → 快速彈窗出現在點擊附近 → 只填標題按儲存 → 日曆出現該筆單次活動。
2. 快速彈窗按「更多選項」→ 完整 modal 開啟且標題已帶入。
3. 點既有每週課 → 詳情彈窗顯示「每週X」與角色 → 按編輯 → 完整 modal 預填 → 存檔觸發修改範圍詢問（既有流程未壞）。
4. 唯讀帳號（無 `calendar`）：點事件只出現唯讀詳情彈窗、無編輯/刪除鈕；點空白格無反應。
5. 窄螢幕（<640px）：兩種彈窗以置中/底部小彈窗呈現、不跑版。
6. `bun run typecheck` 與 `bun run lint` 通過。

## 擴充（第二階段）：更貼近 Google Calendar

在上述兩段式體驗之上，補齊三項**純前端** GCal 能力。使用者的自訂欄位（類型 活動/課程、教室、角色 主持/分享/總結/PM、顏色）全部保留並整合。**不做**需後端基礎設施者：來賓邀請＋Email、Meet 視訊、提醒通知、時區、每日/每月/自訂重複（資料模型只支援不重複/每週）。

### A. GCal 風格的完整編輯器版面（`UModal` 內容重排）

把完整編輯視窗改成 GCal 詳情編輯器的視覺：

- 頂部大字級**標題**輸入。
- 類型（活動/課程）切換維持在標題下。
- 圖示引導的各列：🕐 日期＋「全天」切換＋（非全天）開始–結束時間並列；🔁 重複；📍 地點；🏫 教室；🎨 顏色；👤 角色（僅 `kind==='course'`）；📝 備註。
- `save()` / `remove()` / `applyCourseEdit()`（修改範圍）/ 匯入邏輯**完全不動**，只改版面與欄位排列。

### B. 週／日 檢視切換

- 新增相依 `@fullcalendar/timegrid`；`plugins` 加 `timeGridPlugin`。
- `headerToolbar.right` 改成 `dayGridMonth,timeGridWeek,timeGridDay`，`buttonText` 補「月/週/日」。
- 每週課展開（`expandCourse`）沿用；`datesSet` 已更新可見範圍，換檢視同樣觸發。有 `startTime` 的落在時間格、無 `startTime` 的進全天列。
- **拖曳語意**：`onEventDrop` 對**單次活動**改為「時間感知」——用 `info.event.start`／`info.event.end` 換算新的 `date`＋`startTime`／`endTime`（保留時長）；對**每週課**維持只依 `info.delta.days` 改 `dayOfWeek`（不牽動「修改範圍」流程）。此差異刻意保留、於本節註明。

### C. 拖曳建立（圈選時段）

- `selectable: canEdit.value`、`select: onSelect`。
- `onSelect(info)`：`resetForm()`、`mode='create'`，`form.date = ` 選取起始日；若 `!info.allDay`（週/日檢視圈選時段）帶入 `startTime`／`endTime`（取自 `info.start`／`info.end`）；錨定 `info.jsEvent` 開快速建立彈窗。
- 資料模型單筆事件只有一個 `date`，**跨多日圈選僅取起始日**（於此註明）。

### 時間格點擊的日期解析

`timeGrid` 檢視的 `dateClick` 回傳含時間的 `dateStr`（如 `2026-07-18T09:00:00`）且帶 `allDay`。`onDateClick` 需拆出日期部分存入 `form.date`；若 `!allDay` 再帶入 `startTime`（並補一個預設 1 小時的 `endTime`）。

### 擴充驗證（併入上方手動驗證）

7. 右上角切「週」「日」檢視：每週課與單次活動落在正確時間格；換檢視不崩、可切回月檢視。
8. 週檢視在空白時段**圈選** → 快速彈窗帶入該日與起訖時間。
9. 週檢視拖曳單次活動到別的時間 → 時間與日期一起更新（重整後仍在新時間）。
10. 完整編輯器改版後所有欄位（含角色、重複、修改範圍詢問）仍運作。
