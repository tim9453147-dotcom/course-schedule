# 0024 — 家聚活動紀錄改用課表式日曆

## 目標

把家聚點「活動紀錄」分頁從純清單改成**與課表（`app/pages/index.vue`）相同形式**的
FullCalendar 日曆：月/週/日檢視、點空白格快建、點事件看詳情/編輯、拖曳改日期。

**純前端變更**：只改 `app/components/GatheringRecords.vue`、新增
`app/components/GatheringDetailPopover.vue`。**無 schema / 無 API / 無 migration**——
`GET/POST/PUT/DELETE /api/gatherings` 已足夠（PUT 收完整 body 供拖曳改期；POST 收
name+date+time、其餘給預設供快建）。

## 與課表的差異（家聚更單純）

家聚**不分教室、無重複（全是單次）、無顏色欄位**，故相較課表拿掉三樣東西：

- 無教室分頁（課表的 `classroom` tabs）。
- 無「修改範圍」scope modal、無每週展開（`expandCourse`）——每筆 gathering 對應一個單一日期事件。
- 顏色**單一統一**：用一個常數色（`amber`，取自 `app/utils/schedule.ts` 的 `COLOR_HEX`），不加欄位、不改資料表。

## 日曆本體

- `FullCalendar` 包在 `<ClientOnly>`（同課表慣例），沿用課表 `calendarOptions` 的設定：
  `plugins`（dayGrid/timeGrid/interaction）、`initialView: 'dayGridMonth'`、`locale: zhTwLocale`、
  `firstDay: 0`、`dayHeaderFormat`、`dayCellContent`、`headerToolbar`（月/週/日切換）、
  `buttonText`、`slotMinTime/slotMaxTime`、`height: 'auto'`。
- 事件映射：每筆 gathering →
  ```
  {
    title: g.name,
    start: g.startTime ? `${g.date}T${g.startTime}` : g.date,
    end:   g.endTime   ? `${g.date}T${g.endTime}`   : undefined,
    allDay: !g.startTime,
    color: colorHex(GATHERING_COLOR),   // GATHERING_COLOR = 'amber'
    extendedProps: { refId: g.id }
  }
  ```
- `isTimeGrid`（週/日檢視旗標）沿用課表寫法：只有時間格才 `displayEventTime`、圈選才帶時段。
- `editable/selectable/eventStartEditable` 皆綁 `useCanEdit('gathering')`；`eventDurationEditable: false`。
- `datesSet` 家聚不需重新展開重複事件，但仍用它更新 `isTimeGrid`。

## 三件套互動（比照課表）

### 1. 快建 popover（點空白格 / 圈選）

`dateClick` / `select` → 設定錨點（`virtualAnchor`，同課表的 virtual element 作法）、
`quickOpen = true`、關閉詳情。內容：

- 顯示 `dateLabel(form.date)`。
- 活動名稱 `UInput`（autofocus，Enter 送出）。
- 「全天」`USwitch`（關掉時帶預設時段 19:00–21:00）。
- 非全天時：時／分 `USelect`（沿用 `HOUR_OPTIONS`/`MINUTE_OPTIONS` 與課表的 hour/minute model 寫法）。
- `更多選項` → 把目前快建內容帶進完整表單並開 modal；`儲存` → 直接建立。

快建 `儲存` 只填 name/date/startTime/endTime，其餘欄位在送出前補預設
（`location: '吾心家'`，其餘留空、`recipeId: null`），呼叫 `POST /api/gatherings`。

### 2. 詳情 popover（點事件，唯讀）

`eventClick` → 找到該 gathering、填 `detail`、設錨點、`detailOpen = true`。
新元件 **`GatheringDetailPopover.vue`**（不共用課表的 `EventDetailPopover`，因欄位不同）：

- 標題列：顏色點 + 活動名稱，右上 `編輯`／`刪除` 鈕（`canEdit` 才顯示）。
- 日期 · 時間（`dateLabel` + `timeLabel`）。
- 地點（有才顯示）、地圖連結（有才顯示，`開啟地圖`）。
- 操鍋 / 助手 / 採買（各有值才顯示）。
- `編輯` → 開完整 modal（預填該筆）；`刪除` → 沿用現有 `remove()` 確認流程。

props：`{ detail: GatheringDetail, canEdit: boolean }`；emits：`edit`、`delete`。
`GatheringDetail` 型別在 `GatheringRecords.vue` 內定義即可（或放 `app/utils/schedule.ts`，擇一）。

### 3. 完整編輯 modal（沿用現有豐富表單）

現有 modal 的表單欄位（活動名稱下拉、日期、起訖時間、地點、地圖、操鍋/助手/採買下拉、
流程、參加名單、食譜引用+展開、備註）與 `save()`/`remove()` 邏輯**原封不動保留**，
只是改由「快建的更多選項」或「詳情的編輯」開啟，而非清單列。

現有的名單建議（`contactNames`）、食譜（`recipes`/`recipeItems`）、活動名稱建議
（`nameItems`/`onCreateName`）、`openPicker`、`selectAllOnFocus` 等輔助全部保留。

## 拖曳改期

`eventDrop` → 無 `canEdit` 則 `info.revert()`；否則取該 gathering，
`newDate = toLocalDateStr(info.event.start)`，時間格拖曳連時間一起更新（保留時長），
`PUT /api/gatherings/[id]`（送完整 gathering + 新 date/time），`refresh()` + 成功 toast。
失敗則 toast 並 `info.revert()`。

## 重用

- `app/utils/schedule.ts`：`HOUR_OPTIONS`、`MINUTE_OPTIONS`、`dateLabel`、`timeLabel`、
  `colorHex`、`COLOR_HEX`、`colorDot`。
- 時間 hour/minute 的 computed model、`toLocalDateStr`/`toLocalTimeStr`、`setAnchor`、
  `virtualAnchor` 等小工具比照課表在元件內實作（家聚版更精簡）。
- 權限仍為 `useCanEdit('gathering')`；`useNotify`/`useConfirm`/`useFetch(deep:true)` 樂觀更新慣例不變。

## YAGNI（本次不做）

顏色欄位、跨教室、重複活動、匯入（課表的 AI 匯入不搬過來）、活動照片。清單檢視整段移除（不做切換）。

## 驗證

`just typecheck`、`just lint`；並以瀏覽器對 `just dev` 實際操作：
- 超級管理員：日曆顯示既有家聚；點空白格快建（驗證 allDay 與帶時段兩種）；
  「更多選項」開完整表單填操鍋/食譜並存；點事件看詳情 popover 欄位正確；
  詳情「編輯」改欄位、「刪除」確認後消失；拖曳事件到別天 → date 更新、toast 正確。
- 無 `gathering` 權者：可看日曆與詳情，但無新增鈕、不能點空白格快建、不能拖曳、詳情無編輯/刪除鈕。
