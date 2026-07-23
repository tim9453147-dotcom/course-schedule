# 0029 課表頁手機版左右滑動切換上下個月

日期: 2026-07-23

## 任務目標

在課表頁 (`app/pages/index.vue`) 手機/觸控裝置畫面上，支援左滑 (Swipe Left) 與右滑 (Swipe Right) 手勢切換 FullCalendar 的上下個月（或當前 View 的前後時間區間）。

## 設計決策

1. **手勢方向定義與對應操作**：
   - **左滑 (Finger Right to Left, `deltaX < 0`)**：將目前月份往左推開，顯示下一個月 → 呼叫 `calendarApi.next()`。
   - **右滑 (Finger Left to Right, `deltaX > 0`)**：將目前月份往右推開，顯示上一個月 → 呼叫 `calendarApi.prev()`。

2. **觸控事件觸發機制與防誤觸**：
   - 監聽 `.schedule-calendar` 容器上的 `@touchstart`、`@touchend` 與 `@touchcancel`。
   - **過濾互動元件**：若觸控起點位於既有事件 (`.fc-event`)、彈窗 (`.fc-popover`)、按鈕、輸入框等元件上，不觸發換月，確保點擊/編輯/拖曳事件不受影響。
   - **手勢門檻計算**：
     - 手勢持續時間 `deltaTime <= 500 ms`。
     - 水平移動距離 `Math.abs(deltaX) >= 40 px`。
     - 垂直移動距離 `Math.abs(deltaY) <= 80 px`（避免使用者在垂直滾動頁面時誤觸換月）。
     - 水平移動顯著大於垂直移動：`Math.abs(deltaX) > Math.abs(deltaY) * 1.2`。

3. **樣式優化**：
   - 在 `.schedule-calendar` 加入 `touch-action: pan-y;` CSS 屬性，確保手機原生垂直滾動維持極致順暢，同時允許 JS 側捕獲水平滑動手勢。

## 實作規劃

- **`app/pages/index.vue`**：
  - `<FullCalendar>` 元件加上 `ref="calendarRef"`。
  - 新增 `handleTouchStart`、`handleTouchEnd`、`handleTouchCancel` 手勢處理函式。
  - 在 `.schedule-calendar` 容器上綁定觸控事件與 `touch-action: pan-y;` 樣式。
