# 0031 家聚點新增行程支援同步寫入課表（時間與地點）

日期：2026-07-27

## 任務目標

家聚點的行程本質上屬於全站課表的子行程。
為了減少重複輸入，使用者在「家聚點」（`/gathering`）新增或編輯活動時，可選擇勾選「同步新增至課表」，並選定教室（預設「中壢」）。系統儲存家聚活動的同時，會自動在課表（`events` 單次活動表）中建立一筆對應事件，代入名稱、日期、時間、地點，並自動記錄課表異動供 LINE 通知。

## 需求與邏輯細節

1. **後端 API 擴充 (`gatheringInputSchema` & `POST /api/gatherings` & `PUT /api/gatherings/:id`)**
   - 在 `gatheringInputSchema` 新增選擇性欄位：
     - `syncToCalendar`: `z.boolean().optional().default(false)`
     - `classroom`: `z.string().trim().optional().default('中壢')`
   - 在 `POST /api/gatherings` (以及 `PUT /api/gatherings/:id` 當 `syncToCalendar` 為 `true` 時)：
     - 寫入/更新家聚活動 `gatherings`。
     - 若 `syncToCalendar` 為 `true`：
       - 新增一筆記錄至 `events` 單次活動資料表：
         - `classroom`: `data.classroom || '中壢'`
         - `kind`: `'activity'`
         - `title`: `data.name`
         - `date`: `data.date`
         - `startTime`: `data.startTime || null`
         - `endTime`: `data.endTime || null`
         - `location`: `data.location || null`
         - `color`: `'rose'` (活動代表色)
         - `note`: `data.note || null`
       - 觸發 `logScheduleChange` 寫入 `scheduleChanges` 變更紀錄，使每日 LINE 課表通知能捕獲此新增事件。

2. **前端 UI 擴充 (`app/components/GatheringRecords.vue`)**
   - **Form 表單預設值**：加入 `syncToCalendar: false` 與 `classroom: '中壢'`（若登入者帳號已有 `classrooms` 預設值則帶入其第一間教室）。
   - **快速新增視圖 (Quick Create Popover / Drawer)**：
     - 加入「同步新增至課表」`USwitch` 與教室下拉選單 `USelect` (選項：`CLASSROOMS`)。
   - **完整編輯視圖 (Full Modal)**：
     - 在「地點 / 地圖連結」下方或適當區塊，新增「同步設定」區塊：包含「同步新增至課表」開關與「目標教室」選單。
   - **儲存提示**：
     - 成功建立並同步時提示「已新增家聚活動並同步至課表」。

## 驗證標準

1. `just typecheck` 與 `just lint` 通過。
2. 於家聚點頁面新增家聚活動，勾選「同步新增至課表」並選擇教室（如「中壢」）。
3. 切換至首頁課表（`/`），切換至對應教室（「中壢」），可看到該家聚活動已顯示在課表中，時間與地點均正確代入。
4. 在家聚點新增未勾選同步時，課表不會產生重複事件。
