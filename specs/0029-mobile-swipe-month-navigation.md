# 0029 課表頁手機版左右滑動切換上下個月與流暢動畫

日期: 2026-07-23

## 任務目標

在課表頁 (`app/pages/index.vue`) 手機/觸控裝置畫面上，支援左滑 (Swipe Left) 與右滑 (Swipe Right) 手勢切換 FullCalendar 的上下個月，並提供 1:1 即時跟手拖曳、滑出淡出與彈簧回彈 (Spring Bounce) 等流暢動畫體驗。

## 設計決策與動畫機制

1. **手勢方向定義與對應操作**：
   - **左滑 (Finger Right to Left, `deltaX < 0`)**：將目前月份往左推開，顯示下一個月 → 呼叫 `calendarApi.next()`。
   - **右滑 (Finger Left to Right, `deltaX > 0`)**：將目前月份往右推開，顯示上一個月 → 呼叫 `calendarApi.prev()`。

2. **動態手勢與動畫設計**：
   - **1:1 即時跟手 (Real-time Touch Tracking)**：在 `@touchmove` 期間，`.fc-view-harness` 隨手指橫向移動與透明度變化，提供極致流暢的視覺反饋。
   - **滑出與滑入動畫 (Slide Exit & Entry)**：判定達到換月門檻時，舊月份以 `cubic-bezier(0.4, 0, 0.2, 1)` 滑出淡出，新月份隨即從另一側以 `cubic-bezier(0.16, 1, 0.3, 1)` 滑入，過渡更加自然。
   - **彈簧回彈 (Spring Bounce)**：若移動距離未達門檻釋放手指，視圖以 `cubic-bezier(0.175, 0.885, 0.32, 1.275)` 彈簧曲線平滑回彈至原位。

3. **問題排查與過濾**：
   - 僅排除浮動彈窗與表單元件 (`.fc-popover, button, input, textarea, select`)。
   - 使用 `.capture` 階段監聽觸控事件，避免被 FullCalendar 子元件中斷。
   - 設定深層 `touch-action: pan-y;` 防止瀏覽器橫向原生滑動干擾。

## 實作規劃

- **`app/pages/index.vue`**：
  - 新增 `handleTouchStart`、`handleTouchMove`、`handleTouchEnd`、`handleTouchCancel` 手勢處理函式。
  - 新增 `animateMonthChange` 處理 Smooth Slide-out/Slide-in 動畫過渡。
