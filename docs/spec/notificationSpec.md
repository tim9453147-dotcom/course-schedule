# Notification Center 通知中心規格

> **版本**：v1.0
> **狀態**：草案（可直接交付 AI 開發）

## 設計理念

把通知功能設計成一個**獨立的 Notification Center（通知中心）模組**，不要讓網站後端（Nuxt）直接依賴 LINE / Discord / Email 等平台 API。

核心概念：

> **Nuxt 只負責「我要發通知」**
> **Notification Center 負責「透過哪些平台發送」**

好處：未來要新增 Telegram、Email、Push Notification，都不需要改動網站本身。

整份規格拆成兩部分：

1. **[文件一：Notification Center Core API](#文件一notification-center-core-api)** — 給網站後端（Nuxt）呼叫的統一介面。
2. **[文件二：Notification Provider](#文件二notification-provider)** — 給 LINE / Discord / Telegram / Email 等各平台的實作規範。

---

# 文件一：Notification Center Core API

## 1. 系統目的

建立一個統一的通知服務，供網站後端呼叫。網站不需要知道任何平台細節，只要打一支 API。

```
Website Backend (Nuxt)
        │
        ▼
Notification Center
        │
 ┌──────┼────────┐
 ▼      ▼        ▼
LINE  Discord  Email …
```

## 2. 設計原則：解耦

網站**不需要知道**：

- LINE Messaging API
- Discord Webhook
- Email SMTP

網站**只需要知道**一支端點：

```
POST /notifications/send
```

## 3. API 端點

**Base URL**

```
https://notification.example.com/api
```

### 3.1 發送通知

```
POST /notifications/send
```

**Request Body**

```json
{
  "title": "網站更新通知",
  "content": "新增 AI 教學文章",
  "category": "article",
  "priority": "normal",
  "url": "https://example.com/article/123",
  "image": "https://example.com/image.png",
  "channels": ["line", "discord"]
}
```

**欄位說明**

| 欄位       | 型態     | 必填 | 說明                       |
| ---------- | -------- | ---- | -------------------------- |
| `title`    | string   | ✅   | 通知標題                   |
| `content`  | string   | ✅   | 通知內容                   |
| `category` | string   | ✅   | 分類（見下方）             |
| `priority` | string   | ✅   | 重要程度（見下方）         |
| `url`      | string   | ❌   | 點擊後前往的連結           |
| `image`    | string   | ❌   | 圖片網址                   |
| `channels` | string[] | ✅   | 要發送的平台（見 Provider）|

**`priority` 可用值**

| 值       | 說明   |
| -------- | ------ |
| `low`    | 低     |
| `normal` | 一般   |
| `high`   | 重要   |
| `urgent` | 緊急   |

**`category` 可用值**

| 值             | 說明     |
| -------------- | -------- |
| `article`      | 文章     |
| `announcement` | 公告     |
| `event`        | 活動     |
| `system`       | 系統     |
| `promotion`    | 推廣活動 |

**Response — 成功**

```json
{
  "success": true,
  "notification_id": "ntf_123456"
}
```

**Response — 失敗**

```json
{
  "success": false,
  "error": "LINE_TOKEN_INVALID"
}
```

## 4. 資料庫

### `notifications` — 通知紀錄

| 欄位         | 說明               |
| ------------ | ------------------ |
| `id`         | 主鍵               |
| `title`      | 標題               |
| `content`    | 內容               |
| `category`   | 分類               |
| `priority`   | 重要程度           |
| `url`        | 連結               |
| `created_at` | 建立時間           |

### `notification_logs` — 發送紀錄

每一則通知在每個平台的發送結果各佔一筆。

| 欄位              | 說明                         |
| ----------------- | ---------------------------- |
| `id`              | 主鍵                         |
| `notification_id` | 對應 `notifications.id`      |
| `provider`        | 平台（line / discord / …）   |
| `status`          | `success` / `failed`         |
| `error_message`   | 失敗原因（成功則為空）       |
| `sent_at`         | 發送時間                     |

範例：

| notification_id | provider | status  |
| --------------- | -------- | ------- |
| 123             | LINE     | success |
| 123             | Discord  | success |
| 123             | Email    | failed  |

## 5. 認證

所有 API 都需要在 Header 帶上 API Key，避免陌生人任意發送通知。

```
Authorization: Bearer <API_KEY>
```

範例：

```
Authorization: Bearer abc123456
```

## 6. Nuxt 整合方式

網站後端在某個動作完成後（例如新增文章）呼叫通知中心即可。

**流程**

```
建立文章  →  呼叫 Notification Center  →  完成
```

**Pseudo Code**

```ts
await createArticle(data)

await notification.send({
  title: "新增文章",
  content: data.title,
  category: "article",
  channels: ["line", "discord"],
})
```

---

# 文件二：Notification Provider

這份規範給 LINE / Discord / Telegram / Email 等各平台實作。

## 1. Provider 介面

所有平台都必須實作同一個介面：

```typescript
interface NotificationProvider {
  send(notification: Notification): Promise<Result>
}
```

**輸入 `Notification`**

```typescript
interface Notification {
  title: string
  content: string
  url?: string
  image?: string
  priority: string
}
```

**輸出 `Result`**

```typescript
interface Result {
  success: boolean
  messageId?: string
  error?: string
}
```

## 2. LINE Provider

**支援功能**：Push Message、Broadcast、Multicast

**環境變數**

```
LINE_CHANNEL_ACCESS_TOKEN=
```

**轉換範例**

輸入：

```json
{
  "title": "網站更新",
  "content": "新增文章",
  "url": "https://xxx.com"
}
```

轉為 LINE Flex Message：

```json
{
  "type": "flex",
  "altText": "網站更新",
  "contents": { "type": "bubble" }
}
```

顯示效果：

```
┌─────────────────┐
│ 📢 網站更新      │
│                 │
│ 新增文章         │
│                 │
│ [查看內容]       │
└─────────────────┘
```

## 3. Discord Provider

使用 Discord Webhook。

**環境變數**

```
DISCORD_WEBHOOK_URL=
```

**格式**：Embed Message

```json
{
  "embeds": [
    {
      "title": "網站更新",
      "description": "新增文章",
      "url": "https://xxx.com"
    }
  ]
}
```

顯示效果：

```
==============
📢 網站更新

新增文章

[查看]
==============
```

## 4. Telegram Provider

**環境變數**

```
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

**格式**

```
📢 網站更新

新增文章

https://xxx.com
```

## 5. Email Provider

**環境變數**

```
SMTP_HOST=
SMTP_USER=
SMTP_PASSWORD=
```

**格式**：HTML Email（標題 + 內容 + 按鈕）

## 6. 新增 Provider 的規則

新增一個平台（例如 Slack）只需要：

1. 在 `providers/` 新增 `SlackProvider.ts`
2. 實作 `send()`

**不需要修改**：

- Nuxt 網站
- Notification Center Core API
- 資料庫

---

# 建議專案結構

```
notification-center/
└── src/
    ├── api/
    │   └── notifications.ts
    ├── providers/
    │   ├── LineProvider.ts
    │   ├── DiscordProvider.ts
    │   ├── TelegramProvider.ts
    │   └── EmailProvider.ts
    ├── services/
    │   └── NotificationService.ts
    ├── database/
    │   └── models/
    └── config/
        └── providers.ts
```

---

# MVP 開發順序

| 階段        | 內容                                       | 可達成效果                       |
| ----------- | ------------------------------------------ | -------------------------------- |
| **Phase 1** | Notification API + 資料庫 + LINE Provider  | Nuxt 發布文章 → LINE 收到通知    |
| **Phase 2** | Discord Provider                           | 同時發到 Discord                 |
| **Phase 3** | Telegram Provider + Email Provider         | 覆蓋更多平台                     |
| **Phase 4** | 後台管理                                   | 見下方                           |

**Phase 4 後台管理功能**

- 查看通知紀錄
- 測試發送
- 管理 Token
- 開關各通知渠道

---

# 交付說明

完成本規格後，即可直接對 AI 下指令，例如：

> 請依照 Notification Center Specification v1.0，使用 Nuxt + TypeScript + 資料庫開發。

如此 AI 較容易產生一致的架構，而不需每次重新設計。
