# 0018 — 季節 × 時段 自動主題（春夏秋冬 + 一天時段的整頁色系）

## 背景

spec `0017` 移除了全站色系切換、把畫面寫死「石墨黑」深色。

需求變更：改為**依當前季節與一天中的時段自動切換整體色系**，營造春夏秋冬的氛圍，
讓整個畫面（不只是點綴色）的風格隨時間變化。沒有手動切換 UI，純由時間決定。

（日後計畫再接**天氣 API**，讓畫面反映當前天氣；本次不實作，但架構要為此預留擴充點。）

## 決定

- **模型**：季節決定「色調」（Nuxt UI `primary`/`neutral` 色盤），時段決定「深淺與整頁氛圍」
  （`colorMode` + 背景漸層層）。季節 × 時段 = 16 種組合，但只需維護 4 色調 + 4 時段 + 系統化漸層配方。
- **視覺深度**：除了 accent 色盤，再加一層隨季節/時段變化的**整頁背景漸層**（氛圍層）。
  不做季節裝飾動畫（櫻花/落葉/雪花）。
- **時區**：以 `Asia/Taipei` 固定時區計算季節與時段。教室都在台灣（UTC+8），
  這樣 SSR（Cloudflare 為 UTC）與瀏覽器算出同一結果，**換色不閃爍**。
- **不動 DB**：主題純前端計算，不需 `settings` 表、不產生 migration。
- **擴充點**：`resolveTheme()` 現在輸入 `{ season, daypart }`，未來多加 `weather` 維度時擴充它即可。

## 判定規則（`shared/utils/seasons.ts`，前後端共用單一來源）

季節（依月份，北半球）：

| 季節 | id | 月份 |
|------|------|------|
| 🌸 春 | `spring` | 3–5 |
| ☀️ 夏 | `summer` | 6–8 |
| 🍂 秋 | `autumn` | 9–11 |
| ❄️ 冬 | `winter` | 12、1、2 |

時段（依小時 0–23）：

| 時段 | id | 時間 | 深/淺 |
|------|------|------|------|
| 🌅 清晨 | `dawn` | 05:00–08:59 | 淺色 |
| 🌞 白天 | `day` | 09:00–16:59 | 淺色 |
| 🌇 黃昏 | `dusk` | 17:00–18:59 | 深色（暖色夕陽） |
| 🌙 夜晚 | `night` | 19:00–04:59 | 深色 |

## 色調對應（季節 → `primary` / `neutral`）

| 季節 | primary | neutral | 感覺 |
|------|---------|---------|------|
| 春 | `pink` | `stone` | 櫻花粉嫩 |
| 夏 | `sky` | `slate` | 晴空碧藍 |
| 秋 | `orange` | `stone` | 楓紅琥珀 |
| 冬 | `indigo` | `slate` | 冷冽靛藍/雪白 |

（皆為 Nuxt UI 原生色盤名，改 `appConfig.ui.colors` 即時重繪，無需手寫 CSS。）

## 氛圍層（季節 × 時段 = 16 種整頁背景漸層）

`<html>` 掛 `data-season` + `data-daypart`（SSR 就寫入），`main.css` 以這兩個屬性選擇器定義
**整頁背景漸層**（CSS 變數 `--app-bg`），套在 `body`／`UApp` 後方。配方原則：

- **季節**定漸層的色系家族（春=粉綠、夏=藍青、秋=琥珀楓橘、冬=靛藍雪白）。
- **時段**定明暗與暖冷：清晨=淺而柔、白天=明亮清透、黃昏=暖色夕陽（深）、夜晚=深邃（深）。

代表例：
- 秋・黃昏 = 琥珀 → 楓橘 → 暗靛 的夕陽漸層（深）
- 冬・夜晚 = 深藍 → 近黑 的雪夜漸層（深）
- 春・白天 = 淺櫻粉 → 白 的清透漸層（淺）
- 夏・清晨 = 淺天藍 → 米白 的晨光漸層（淺）

未來的天氣層（下雨灰霧、下雪等）疊在這一層之上。

## 變更

新增：
- `shared/utils/seasons.ts` — `Season`/`Daypart` 型別、`SEASONS`/`DAYPARTS` 登記表、
  `getSeason(month)`、`getDaypart(hour)`、`resolveTheme({ season, daypart })`（回傳
  `{ season, daypart, primary, neutral, mode }`），以及一個純函式 `nowParts(date, timeZone)`
  把時間換算成 `{ season, daypart }`（以 `Asia/Taipei` 計算）。
- `app/composables/useSeasonalTheme.ts` — 一個 `now` ref（每分鐘 + 分頁 `visibilitychange`/`focus`
  時更新），computed 出當前 `resolveTheme()`，並套用到 `appConfig.ui.colors` 與 `colorMode.preference`；
  回傳當前 `{ season, daypart }` 供 `htmlAttrs` 用。支援網址 query `?season=`/`?daypart=` 強制指定
  （僅供截圖驗證，不做成 UI）。
- `app/plugins/seasonal-theme.ts` — 啟動即套用；並在 `app:mounted` 後 `nextTick` 補套一次
  `colorMode.preference`（`@nuxtjs/color-mode` 掛載時會重設，見 spec 0016 的坑）。

編輯：
- `app/app.vue` — 用 `useHead` 把 `data-season`/`data-daypart` 掛到 `htmlAttrs`。
- `app/assets/css/main.css` — 定義 16 組 `:root[data-season="…"][data-daypart="…"]` 的 `--app-bg`
  漸層，並讓 `body` 套用；深/淺色交給 Nuxt UI 的 `.dark` 機制，漸層只負責氛圍。
- `nuxt.config.ts` — `colorMode` 不再寫死 `preference: 'dark'`（改由主題驅動），更新過時註解。
- `app/app.config.ts` — 預設 `primary`/`neutral` 改為合理 fallback（SSR 首屏用），更新註解。

## 不做（YAGNI）

- 不做手動切換 UI、不做 per-user 偏好、不動 DB。
- 不做季節裝飾動畫（櫻花/落葉/雪花）。
- 天氣 API 本次不實作，僅預留 `resolveTheme` 擴充位置。

## 驗證

- `bun run typecheck` + `bun run lint` 通過。
- `bun dev` 下用 `?season=…&daypart=…` 逐一檢視 16 種組合：色盤（primary/neutral）、
  深/淺色、整頁背景漸層皆隨組合改變，且切換不閃爍。
- 不帶 query 時，畫面依當下台灣時間呈現對應季節/時段主題。
