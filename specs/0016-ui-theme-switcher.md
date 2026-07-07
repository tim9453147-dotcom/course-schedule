# 0016 - 全站色系主題（超級管理員設定，所有使用者共用）

## 目標

在 header bar 提供「色系主題」下拉，從多組預設主題挑選；每組主題 = 一組 primary/neutral
調色盤 + 深/淺色模式。**此為全站設定**：只有超級管理員能改，改完後**所有使用者（含未登入者）
共用同一主題**。非超級管理員看不到下拉，只會套用到管理員設定的主題。

作法沿用 `patent-embedding-nuxt-poc` 的精神（THEMES 登記表 + composable + 啟動載入 + header 下拉），
但主題不用手寫 `[data-theme]` CSS，而是對應 Nuxt UI 原生的 `appConfig.ui.colors`（primary/neutral）
與 `colorMode`，Nuxt UI 即時重繪；且設定來源改為**伺服器（D1）**而非個人 localStorage。

（沿革：多主題下拉 → 一度收斂為固定深色 → 恢復下拉切換（per-user localStorage）→ 現改為
全站、超級管理員專屬設定。）

## 主題清單（`shared/utils/themes.ts` 的 `THEMES`，前後端共用單一來源）

| id | 名稱 | primary | neutral | 模式 |
|----|------|---------|---------|------|
| `black` | 石墨黑（預設） | zinc | neutral | 深色 |
| `cyber` | 科技感 | cyan | slate | 深色 |
| `ocean` | 海洋藍 | blue | slate | 深色 |
| `indigo` | 靛藍 | indigo | slate | 深色 |
| `forest` | 森林綠 | emerald | zinc | 深色 |
| `violet` | 霓虹紫 | violet | zinc | 深色 |
| `fuchsia` | 桃紅 | fuchsia | zinc | 深色 |
| `rose` | 玫瑰紅 | rose | stone | 深色 |
| `sunset` | 日落橘 | orange | stone | 深色 |
| `light` | 明亮 | zinc | neutral | 淺色 |
| `cute` | 可愛風 | pink | stone | 淺色 |
| `beach` | 沙灘風 | amber | stone | 淺色 |
| `mint` | 薄荷綠 | teal | gray | 淺色 |

新增／調整主題 = 改這張表一行即可（下拉、驗證、載入全部帶出）。

## 做法

**資料儲存** — `server/db/schema.ts` 新增通用鍵值表 `settings`（`key` PK / `value` / `updatedAt`），
主題存在 `key='theme'`。migration `0015_brief_speed.sql`（`db:generate` → `db:migrate:local`；
remote 於部署前後跑 `db:migrate:remote`）。

**API**
- `GET /api/settings/theme` — 公開，任何人（含未登入）皆可讀，回 `{ theme }`；未設定／不合法回 `DEFAULT_THEME`。
- `PUT /api/settings/theme` — 先 `requireSuperAdmin(event)`；body `{ theme }` 需 `isThemeId`，
  upsert `theme` 鍵。非超級管理員 403。

**載入與套用** — `app/plugins/theme.ts`（通用 plugin，非 `.client`）於啟動時呼叫 `useTheme().load()`：
以 `useAsyncData` 讀 `GET /api/settings/theme`（SSR 抓一次、payload 帶到 client 不重抓），
套用 `appConfig.ui.colors.primary/neutral`（SSR 就套好，accent 不閃）與 `colorMode.preference`。

**深/淺色的兩個細節**：
1. `nuxt.config.ts` 的 `colorMode.storage = 'cookie'`（key `cs-color-mode`）：SSR 讀得到 cookie，
   已造訪過的瀏覽器再次載入時，伺服器就渲染正確深/淺色、不閃。
2. `@nuxtjs/color-mode` 的 client plugin 會在 `app:mounted` 把 `preference` 重設成 cookie 值
   （首次造訪無 cookie ⇒ 預設 dark），會蓋掉我們的設定。故 plugin 在 `app:mounted` 後用
   `nextTick` 再 `applyMode()` 一次，確保晚於 color-mode 的重設而生效。

**前端權限** — `app/app.vue` header 的「主題」`UDropdownMenu` 加 `v-if="isSuper"`。
選取項目呼叫 `setTheme(id)`（PUT 存回伺服器後即時套用），成功/失敗以 toast 提示。

## 已知權衡

深/淺色的「首次造訪」（瀏覽器尚無 `cs-color-mode` cookie）若全站主題為淺色，會由預設 dark
短暫閃一下再切成 light（`app:mounted` 後 `nextTick` 補套並寫回 cookie）；之後每次載入 SSR 直接
讀 cookie 渲染正確模式、不再閃。深色主題與 accent 顏色皆不受影響（SSR 先套好）。若要連首次造訪
都零閃，需再加 server middleware，於 SSR 前依全站主題把 `cs-color-mode` 注入 request cookie。

## 驗證

- 超級管理員切換主題 → 存回伺服器；一般／未登入使用者重新載入後套用到同一主題。
- 非超級管理員看不到「主題」下拉。
- 重新整理保留（來源為伺服器，非個人偏好）。
