# 0026 — 每日「今日課表」提醒（併入每日通知）

## 目標

在現有每天早上 8 點的通知（spec 0025）中，**加上「今日課表」**：只要當天有課程或活動，
就在 LINE 群組發一則今日課表提醒；若同時有課表異動，異動接在同一則訊息下半部。

> 觸發時機沿用 spec 0025 的 GitHub Actions cron（每天 00:00 UTC = 台灣 08:00），
> **不新增排程**，只擴充 `POST /api/notifications/daily-digest` 的內容與發送條件。

## 發送條件

每天 8 點呼叫 `daily-digest` 時：

| 今日有課程/活動 | 有未通知異動 | 動作 |
| --------------- | ------------ | ---- |
| 是 | — | 發送（今日課表 [+ 異動]） |
| 否 | 是 | 發送（僅異動，同 0025） |
| 否 | 否 | 不發送 |

## 「今日課表」的內容

以**台灣時區（UTC+8）**判斷「今天」是哪一天、星期幾，跨**所有教室**收集：

- **課程（`courses`）**：`dayOfWeek` = 今天星期，且
  - 重複範圍內：（`startDate` 為 null 或 ≤ 今天）且（`endDate` 為 null 或 ≥ 今天）
  - 未被例外日排除：今天不在 `exDates`（JSON 陣列）內
- **活動（`events`）**：`date` = 今天

實作：課程用 SQL 依 `dayOfWeek` + 日期範圍粗篩，再於 JS 過濾 `exDates`；活動用 SQL 依 `date` 精確查。

## 訊息格式（合併一則）

```
☀️ 早安！今日課表（7/21 週一）

【中壢】
09:00 產品課（總結：王大明）
14:00 說明會

【新竹】
19:00 新人培訓（總結：李小華）

━━━━━━━━━━
🔔 近期異動
【中壢】
➕ 活動「家聚」7/22(二) 19:00
```

- 標頭：`☀️ 早安！今日課表（{M}/{D} 週{X}）`。
- 今日課表：依教室 `【】` 分組；組內按 `startTime` 由早到晚排序（整天項目無時間，排最前、標「全天」）。
- 每筆：`{HH:MM 或「全天」} {名稱}`，若該筆有 `summarizer` 則加上 `（總結：{名字}）`（活動或未填總結則省略）。
- 「近期異動」區塊僅在有未通知異動時出現，內容與排版沿用 spec 0025（emoji + summary，依教室分組），以分隔線與今日課表隔開。
- 若「今天沒課但有異動」，則不顯示今日課表標頭，只發異動（等同 0025 舊行為）。

## 端點流程調整（`daily-digest.post.ts`）

1. Bearer 金鑰驗證（同 0025）。
2. 撈未通知異動 → 去重取 `survivors`（沿用 0025 的 `resolveChanges`）。
3. 算 `todayItems`（今日課程 + 活動，見上）。
4. `shouldSend = todayItems.length > 0 || survivors.length > 0`。
5. `shouldSend === false`：把已撈出的異動列標記 `notifiedAt`（抵銷或無），回 `{ sent:false, reason:'no_changes' }`，不發送。
6. `shouldSend === true`：
   - 檢查設定（群組 ID + access token）；缺 → 回 `{ sent:false, reason:'not_configured' }`，**不標記**（設定好後下次可發）。
   - 組合訊息（今日課表區塊 + 視情況的異動區塊）→ `linePush`。
   - 成功：標記已撈異動的 `notifiedAt`、寫 `notification_logs`，回 `{ sent:true, todayCount, changeCount }`。
   - 失敗：寫 `notification_logs`，**不標記**（下次 cron 重試），回 `{ sent:false, reason:'send_failed' }`。

## 要改 / 新增的檔案

- 新增 `server/utils/todaySchedule.ts`：
  - `getTaiwanToday()` → `{ date: 'YYYY-MM-DD', dayOfWeek: 1..7, month, day, weekdayLabel }`
  - `collectTodaySchedule(db, today)` → 依教室分組、組內排序的今日項目
  - `buildTodayScheduleBlock(grouped, today)` → 今日課表文字區塊
- 修改 `server/api/notifications/daily-digest.post.ts`：加入今日課表、調整發送條件與訊息組裝；`buildDigestMessage`（異動區塊）拆成可被合併的片段。
- **純後端**：無 schema、無 migration。

## 驗證

- 無自動化測試（符合專案現況）。
- 本地 `bun dev`：
  - 插入今日對應星期的課程（含一筆在 `exDates` 內的、一筆超出日期範圍的，確認被排除）+ 今日活動；打 `daily-digest` 確認今日課表格式、排序、總結顯示。
  - 造一筆課表異動 → 確認合併訊息含「近期異動」區塊。
  - 清掉今日課程/活動且無異動 → 確認回 `no_changes`、不發送。
