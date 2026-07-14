# 0025 — 課表異動每日 LINE 群組通知

## 目標

課表（`courses` / `events`）有新增/修改/刪除時，**每天早上 8 點**把「上次通知後累積的所有異動」
彙整成一則清單，push 到指定的 **LINE 群組**通知群裡的使用者。若當天沒有任何異動就不發。

保留 `docs/spec/notificationSpec.md` 的**解耦精神**（網站只管「要發通知」，發送細節收在一層 provider
抽象裡，未來可加 Discord/Telegram），但**不另開獨立 Notification Center 服務**——在本專案內以薄抽象實作即可。

## 為什麼需要外部排程器

本專案以 **Cloudflare Pages** 部署，Pages **不支援 Cron Triggers**（那是 Workers 專屬功能），
App 只在收到 HTTP 請求時才會醒來，無法自己在 8 點觸發。故排程改由 **GitHub Actions cron**（設定檔就在本 repo）
定時呼叫 App 自己的受保護端點。核心邏輯全留在本專案 server 內，GitHub 只當「鬧鐘」。

（另一條路是把部署從 Pages 遷到 Cloudflare Workers 用原生 cron，成本較高，本 spec 不採用。）

## 架構

```
課表 API 變動 (courses/events 的 POST/PUT/DELETE + events/import)
        │  logScheduleChange() 寫一筆變更紀錄
        ▼
   schedule_changes 表   (notifiedAt IS NULL = 待通知)
        ▲
        │  撈未通知的異動 → 去重 → 彙整
GitHub Actions cron ──► POST /api/notifications/daily-digest  (Bearer 保護)
                                │
                                ▼
                        utils/notify/line.ts ──► LINE Messaging API push 到群組
```

## 資料模型（新增 2 張表，`courses`/`events` 不動）

### `schedule_changes`（變更紀錄 / change log）

| 欄位         | 型態                          | 說明                                             |
| ------------ | ----------------------------- | ------------------------------------------------ |
| `id`         | integer PK                    |                                                  |
| `entityType` | text                          | `course` / `event`                               |
| `entityId`   | integer                       | 對應課程/活動的 id                               |
| `action`     | text                          | `created` / `updated` / `deleted`                |
| `classroom`  | text                          | 中壢/新竹/台北/台中                              |
| `summary`    | text                          | 當下的可讀快照文字（見下）                       |
| `createdAt`  | integer (timestamp)           | 異動發生時間                                     |
| `notifiedAt` | integer (timestamp), nullable | 已通知回填的時間；`NULL` = 待通知                |

- 「今天有沒有異動」= 是否存在 `notifiedAt IS NULL` 的列。
- 刪除也記得到（在刪除前把快照寫進 `summary`），不受資料列消失影響。
- `summary` 於寫入當下產生，例如：`活動「家聚」7/22(二) 19:00`、`課程「產品課」每週三 20:00`。

### `notification_logs`（發送紀錄，對齊原 spec）

| 欄位           | 型態                | 說明                          |
| -------------- | ------------------- | ----------------------------- |
| `id`           | integer PK          |                               |
| `channel`      | text                | `line`（未來 discord/…）      |
| `target`       | text                | 群組 ID                       |
| `status`       | text                | `success` / `failed`          |
| `errorMessage` | text, nullable      | 失敗原因                      |
| `sentAt`       | integer (timestamp) |                               |

### `settings` 重用（既有閒置表，key/value）

- key `line_group_id` → 由 webhook 自動寫入的群組 ID。

Migration：改 `server/db/schema.ts` 後 `db:generate` → `db:migrate:local` → `db:migrate:remote`。

## 變更紀錄的寫入點

抽出 helper `server/utils/scheduleChange.ts`：

```ts
logScheduleChange(event, { entityType, entityId, action, classroom, summary })
```

在下列路由的成功寫入後各補一次呼叫：

- `server/api/courses/index.post.ts`（created）
- `server/api/courses/[id].put.ts`（updated）
- `server/api/courses/[id].delete.ts`（deleted，刪除前先組 summary）
- `server/api/events/index.post.ts`（created）
- `server/api/events/[id].put.ts`（updated）
- `server/api/events/[id].delete.ts`（deleted）
- `server/api/events/import.post.ts`（記一筆彙整型 created：`entityId=0`、summary=`批次匯入 N 筆活動`；`entityId=0` 於去重時視為各自獨立、不與其他列合併）

## LINE 串接

用 **LINE Messaging API**（LINE Notify 已於 2025 停用，不採用）。

### 取得群組 ID：`POST /api/line/webhook`

- 驗證 `x-line-signature`：用 channel secret 對 raw body 做 HMAC-SHA256 + base64 比對；不符 → 401。
- 當機器人被加進群組（`join` 事件）或群組裡有訊息（`message` 事件且 `source.type === 'group'`）時，
  把 `source.groupId` upsert 進 `settings.line_group_id`。
- 使用者只要把機器人拉進群組即可自動綁定，不需手動找 ID。

### 發送：`server/utils/notify/line.ts`

- `pushToGroup(config, groupId, text)`：POST `https://api.line.me/v2/bot/message/push`，
  Header `Authorization: Bearer <channelAccessToken>`，body `{ to: groupId, messages: [{ type: 'text', text }] }`。
- 用 `fetch`（無 SDK，符合 Workers 相容性，比照 `ai-extract.post.ts` 的做法）。
- 回傳 `{ success, error? }`；供未來新增 provider 時對齊介面。

## 每日彙整端點：`POST /api/notifications/daily-digest`

1. **認證**：`Authorization: Bearer <NUXT_NOTIFY_CRON_SECRET>`，錯/缺 → 401。（此端點需公開讓 GitHub Actions 打得到，故靠 Bearer 金鑰保護，不走使用者 session。）
2. 缺 `line_group_id` 或缺 access token → 回 `{ sent: false, reason: 'not_configured' }`（HTTP 200，不讓 cron 噴錯）。
3. 撈 `notifiedAt IS NULL` 的變更，**依 `(entityType, entityId)` 去重取淨結果**：
   - 多次 `updated` → 一筆「修改」（取最新 `summary`）。
   - `created` 後又 `deleted`（同一 id 且尚未通知）→ 該項略過。
   - 其餘取該 id 最後一筆 action。
4. 去重後為空 → 回 `{ sent: false, reason: 'no_changes' }`。
5. 依 `classroom` 分組，組成一則文字訊息，`pushToGroup` 發送。
6. push **成功** → 把這批列的 `notifiedAt` 回填、寫一筆 `notification_logs(status:success)`，回 `{ sent: true, count }`。
7. push **失敗** → **不回填 `notifiedAt`**（下次 8 點自動重試整批）、寫 `notification_logs(status:failed, errorMessage)`，回 `{ sent: false, reason: 'send_failed' }`。

### 訊息格式（v1 純文字，先不用 Flex）

```
📅 課表異動通知（7/14）

【中壢】
➕ 活動「家聚」7/22(二) 19:00
✏️ 課程「產品課」每週三 20:00
🗑️ 活動「說明會」7/15

【新竹】
➕ 課程「新人培訓」每週六 14:00
```

- action → emoji：`created`=➕、`updated`=✏️、`deleted`=🗑️。
- 教室以 `【】` 分段；每段內列出該教室的異動行（`summary`）。

## 排程：GitHub Actions

`.github/workflows/daily-notify.yml`

```yaml
on:
  schedule:
    - cron: '0 0 * * *'   # 00:00 UTC = 台灣 08:00
  workflow_dispatch:       # 允許手動測試觸發
jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS -X POST "https://course-schedule-2689336.pages.dev/api/notifications/daily-digest" \
            -H "Authorization: Bearer ${{ secrets.NOTIFY_CRON_SECRET }}"
```

- GitHub cron 可能延遲數分鐘，對每日彙整無影響。
- `NOTIFY_CRON_SECRET` 需同時設為 **GitHub repo secret** 與 **Cloudflare Pages secret**。

## 設定 / 環境變數

`nuxt.config.ts` `runtimeConfig` 新增（皆由對應 `NUXT_*` 環境變數覆寫）：

| runtimeConfig 鍵           | 環境變數                          | 用途                     |
| -------------------------- | --------------------------------- | ------------------------ |
| `lineChannelAccessToken`   | `NUXT_LINE_CHANNEL_ACCESS_TOKEN`  | push 訊息                |
| `lineChannelSecret`        | `NUXT_LINE_CHANNEL_SECRET`        | webhook 簽章驗證         |
| `notifyCronSecret`         | `NUXT_NOTIFY_CRON_SECRET`         | daily-digest Bearer 金鑰 |

- 本地：寫進 `.env`（gitignored），並更新 `.env.example`。
- 線上：設為 Cloudflare Pages secrets；**secret 變更需下次部署才生效**。

## 錯誤處理摘要

- webhook 簽章不符 → 401；digest Bearer 不符 → 401。
- 未設定（缺 group/token）→ 200 + `not_configured`，不噴錯。
- 無異動 → 200 + `no_changes`，不發訊息。
- push 失敗 → 不回填 `notifiedAt`（隔天重試）、記 `notification_logs`。

## 需要改 / 新增的檔案

- 新增：`api/notifications/daily-digest.post.ts`、`api/line/webhook.post.ts`、
  `utils/notify/line.ts`、`utils/scheduleChange.ts`、`.github/workflows/daily-notify.yml`。
- 修改：`server/db/schema.ts`（+2 表、migration）、上列 7 支課表 mutation 路由、
  `nuxt.config.ts`（runtimeConfig）、`.env.example`。

## 驗證

- 無自動化測試（符合專案現況）。
- 本地 `bun dev`（`just dev`）→ 造幾筆課表異動 → `curl -X POST .../api/notifications/daily-digest -H "Authorization: Bearer <secret>"`，
  確認去重、分組、訊息格式，以及發送成功後 `notifiedAt` 被回填、再打一次回 `no_changes`。
- 把機器人拉進測試群組確認 webhook 有寫入 `line_group_id`，並實際收到一則 push。
