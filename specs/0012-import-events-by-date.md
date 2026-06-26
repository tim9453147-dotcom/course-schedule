# 0012 — 匯入改為「依日期匯入單次活動」

## 背景

0011 的匯入功能是把 JSON 寫進 `courses`（每週重複課程，用 `dayOfWeek`）。實際使用上課表是**逐月、逐日**安排的，使用者要的是依「日期」匯入一整個月的單次活動，而不是每週重複。

決定：把匯入**改成日期制**——寫進 `events`（單次活動，用 `date`），移除原本的每週課程匯入。

## JSON 格式（餵給 AI 的目標格式）

頂層為陣列，每筆一個物件。`classroom`（教室分頁）不放在 JSON 裡，由匯入畫面選的教室統一帶入；`color` 可省略。

```json
[
  {
    "title": "超凡訓練",
    "date": "2026-06-04",
    "startTime": "19:30",
    "endTime": "21:00",
    "host": "偉霖", "sharer": "", "summarizer": "凱平哥", "pm": "尚融",
    "location": "中壢教室"
  }
]
```

- **`date`**（`YYYY-MM-DD`，必填）取代原本的 `dayOfWeek`。
- **`kind`**：一律存成 `course`，**忽略 JSON 內的 `kind`**（即使來源資料寫了 `meeting`/`training` 也一視同仁；系統目前只有 course/activity 兩種分類，不為匯入擴充）。
- `startTime`/`endTime` 空字串視為整天。
- `location` 照 JSON 帶入（例如「中壢教室」純粹是地點文字，與教室分頁無關）。

## 後端

- 新增 `server/api/events/import.post.ts`，刪除 `server/api/courses/import.post.ts`。
- `server/utils/validation.ts`：移除 `dayOfWeekLenient`、`courseImportItemSchema`、`importCoursesSchema`；新增 `eventImportItemSchema`、`importEventsSchema`。
  - `eventImportItemSchema` 用 `date`（必填），不含 `kind`（後端硬寫 `course`）。
  - `importEventsSchema` 多兩個可選欄位 `replaceFrom`/`replaceTo`（覆蓋模式的日期區間）。
- `items` 仍 `.max(45)`（D1 免費方案 50 query/次的硬防呆，前端切塊）。
- **覆蓋模式語意改變**：不再清空整個教室，而是只刪除此教室**在 `[replaceFrom, replaceTo]` 日期區間內**的活動，再插入——避免一次匯入某月就把其他月份的活動也清掉。日期區間由前端取整批 items 的 min/max 日期，隨第一塊（`replace`）帶上。
- 與 0011 相同用 `db.batch` 包成原子操作；第一塊 `replace`、其餘塊 `append`。

## 前端（`app/pages/index.vue`）

- 解析以 `date` 取代 `dayOfWeek`（驗 `YYYY-MM-DD`），`kind` 不再讀取、預覽固定顯示「課程」。
- 匯入打 `/api/events/import`，完成後 `refreshEvents()`。
- 覆蓋模式說明改成「先刪除此教室在匯入日期範圍內的活動」；送出前算出整批 min/max 日期當 `replaceFrom`/`replaceTo`。
- 預覽表把「星期」欄改成「日期」欄；AI 指令與 placeholder 改為日期格式。

## 非目標

- 不擴充 `kind`（不新增 meeting/training 分類）。
- 不做「app 內直接上傳圖片由後端轉 JSON」。
