# 0030 家聚點活動紀錄改用課表式日曆與手機版 UX 優化

日期：2026-07-27

## 任務目標

將家聚點「活動紀錄」（`app/components/GatheringRecords.vue`）從傳統按鈕清單，重構成與課表頁面（`app/pages/index.vue`）完全一致的 **FullCalendar 日曆** 視圖。
特別強化手機/觸控裝置的操作體驗：支援 1:1 跟手滑動換月動畫、手機版專用切換列、手機版 FAB 新增按鈕、以及手機版 UDrawer 底部抽屜（快建/詳情彈窗）。

## 設計與功能要點

### 1. 日曆主體 (FullCalendar)
- 統一採用琥珀色（`amber`）作為家聚活動的代表色。
- 事件映射：將 `gatherings` 資料轉為 FullCalendar 事件（含起訖時間、`allDay` 標示、`colorHex('amber')`）。
- 切換檢視：支援「月 (dayGridMonth)」、「週 (timeGridWeek)」、「日 (timeGridDay)」。
- 支援拖曳改期（`eventDrop`）：當使用者具備 `gathering` 編輯權限時，可直接拖拉活動更改日期/時間，並連動 `PUT /api/gatherings/:id` API。

### 2. 手機版 UX 極致優化
- **極致邊界與字級**：對齊 `.schedule-calendar` CSS 樣式，簡化頭部欄位與格子間距。
- **手機版專用控制列 (`sm:hidden`)**：提供「今天」與「月 / 週 / 日」快捷切換按鈕。
- **手機版 Floating Action Button (FAB)**：右下角懸浮按鈕（`+` icon），方便單手點擊直接進入新增活動流程。
- **手機版 1:1 手勢跟隨與流暢過渡 (Mobile Touch / Swipe)**：
  - 手指在日曆區塊左右滑動時，即時 1:1 拖曳 `.fc-view-harness` 視圖與透明度變化。
  - 達滑動門檻時觸發滑出淡出與新月份滑入動畫（Slide-out/Slide-in）。
  - 未達門檻釋放時自動以彈簧曲線（Spring bounce）平滑復位。
  - 自動排除浮層與按鈕 (`.fc-popover, button, input, textarea, select, .navigation-drawer`)，防止誤觸。
- **手機版 UDrawer / 桌機版 UPopover**：
  - 快建與詳情在手機版一律使用 `UDrawer` 底部抽屜，適應觸控手勢與單手操作；桌機版則使用 Floating UI `UPopover` 錨點定位。

### 3. 三件套互動機制
1. **點擊空白格 (Date / Range Select) → 快速建立 (Quick Create)**
   - 帶入所選日期與預設全天/時間（如 19:00–21:00）。
   - 快速填寫標題，按 Enter 或點「儲存」即可預設地點為「吾心家」快速建立。
   - 點「更多選項」打開完整表單 Modal。
2. **點擊既有活動 → 明細彈窗 (GatheringDetailPopover)**
   - 顯示活動名稱、日期時間、地點（與地圖連結）、操鍋/助手/採買人名、料理與食材作法展開、流程、參加名單、備註。
   - 具備編輯權限時，顯示盈餘徽章（綠 `+` / 紅 `−` 與金額），並提供「編輯」與「刪除」按鈕。
3. **完整編輯 modal (Full Modal)**
   - 完整保留現有的所有高級欄位（活動名稱自動建議與新增、日期/時間選擇器、地點與地圖、人員選單、流程、參加名單、食譜引用與展開、備註、收支折疊與即時算式）。

## 檔案異動

1. **`app/components/GatheringDetailPopover.vue`** (全新建立)：家聚點活動詳情彈窗/抽屜元件。
2. **`app/components/GatheringRecords.vue`** (修改重構成日曆與手勢互動)：引進 FullCalendar、UDrawer、UPopover、Touch 觸控滑動等。

## 驗證標準

- `just typecheck` 通過無 TS 錯誤。
- `just dev` 實測：
  - 超級管理員/具編輯權限者：可看月/週/日檢視，可手勢滑動換月，可點空白格快建，可點活動開詳情與完整編輯/刪除，可拖曳活動更新日期。
  - 純檢視者：可切換檢視與換月，可點活動查看詳情（包含料理食材作法），無快建、無拖曳、詳情無編輯/刪除按鈕。
