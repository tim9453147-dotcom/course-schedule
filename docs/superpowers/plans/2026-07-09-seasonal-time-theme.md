# 季節 × 時段 自動主題 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 依當前季節（春夏秋冬）與一天時段（清晨/白天/黃昏/夜晚）自動切換整站色系（Nuxt UI primary/neutral 色盤 + 深/淺色 + 整頁背景漸層），無手動切換 UI。

**Architecture:** 純前端計算，無 DB。單一來源 `shared/utils/seasons.ts` 提供季節/時段判定與 `resolveTheme()`；composable 反應式地把結果套到 `appConfig.ui.colors` 與 `colorMode.preference`；plugin 負責啟動套用與定時更新；整頁背景漸層由 `<html>` 的 `data-season`/`data-daypart` 屬性選到 `main.css` 定義的 16 組漸層。時間以 `Asia/Taipei` 固定時區計算，讓 SSR 與瀏覽器一致、換色不閃。

**Tech Stack:** Nuxt 4、@nuxt/ui 4.8、@nuxtjs/color-mode 3.5（隨 @nuxt/ui）、Tailwind v4、TypeScript。無測試框架。

## Global Constraints

- 一律用 `just`（自動釘 node v24.17.0）：`just typecheck`、`just lint`、`just dev`。勿直接跑 `bun`（系統 node 為 v18，會壞）。
- 註解與 UI 文案用**繁體中文**，比照周邊風格。
- Nuxt UI 色盤名（`pink`/`sky`/`orange`/`indigo`/`slate`/`stone` 等）**逐字寫死**；**絕不動態組字串**產生 Tailwind class（Tailwind 不會產出）。
- `shared/` 與 `app/composables/`、`app/plugins/` 由 Nuxt 4 自動匯入，**不要手寫 import**（型別 `Season`/`Daypart` 等亦自動可用）。
- 無自動化測試框架：純邏輯用一次性 node 斷言腳本驗證；UI 用 `just typecheck` + `just lint` + 瀏覽器實測。
- 設計依 `specs/0018-seasonal-time-theme.md`。
- 提交訊息用 Conventional Commits（可中文）。

---

### Task 1: 季節/時段判定與主題解析（單一來源）

**Files:**
- Create: `shared/utils/seasons.ts`
- Verify (throwaway, 不提交): `/tmp/claude-1001/-home-tim-githubRepo-amway-course-schedule/036135b6-11d5-445f-9881-80392237d871/scratchpad/check-seasons.mjs`

**Interfaces:**
- Produces（後續 Task 依賴這些名稱與型別）:
  - `type Season = 'spring' | 'summer' | 'autumn' | 'winter'`
  - `type Daypart = 'dawn' | 'day' | 'dusk' | 'night'`
  - `type Mode = 'light' | 'dark'`
  - `interface ResolvedTheme { season: Season; daypart: Daypart; primary: string; neutral: string; mode: Mode }`
  - `const SEASONS: Season[]`、`const DAYPARTS: Daypart[]`
  - `function isSeason(v: unknown): v is Season`、`function isDaypart(v: unknown): v is Daypart`
  - `function getSeason(month: number): Season`（month 1–12）
  - `function getDaypart(hour: number): Daypart`（hour 0–23）
  - `function nowParts(date: Date, timeZone?: string): { season: Season; daypart: Daypart }`（預設 `'Asia/Taipei'`）
  - `function resolveTheme(input: { season: Season; daypart: Daypart }): ResolvedTheme`

- [ ] **Step 1: 建立 `shared/utils/seasons.ts`**

```ts
// 季節 × 時段 自動主題的單一來源（Nuxt shared/ 前後端自動匯入）。
// season 由月份決定、daypart 由小時決定；resolveTheme() 把兩者組合成一組 Nuxt UI 設定
// （primary/neutral 色盤 + 深/淺）。未來要接天氣 API：擴充 resolveTheme 的入參即可。

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export type Daypart = 'dawn' | 'day' | 'dusk' | 'night'
export type Mode = 'light' | 'dark'

export interface ResolvedTheme {
  season: Season
  daypart: Daypart
  primary: string
  neutral: string
  mode: Mode
}

export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter']
export const DAYPARTS: Daypart[] = ['dawn', 'day', 'dusk', 'night']

// 季節 → Nuxt UI 色盤（primary 主色 / neutral 灰階家族）
export const SEASON_COLORS: Record<Season, { primary: string, neutral: string }> = {
  spring: { primary: 'pink', neutral: 'stone' }, // 櫻花粉嫩
  summer: { primary: 'sky', neutral: 'slate' }, // 晴空碧藍
  autumn: { primary: 'orange', neutral: 'stone' }, // 楓紅琥珀
  winter: { primary: 'indigo', neutral: 'slate' } // 冷冽靛藍/雪白
}

// 時段 → 深/淺色
export const DAYPART_MODE: Record<Daypart, Mode> = {
  dawn: 'light', // 清晨（柔）
  day: 'light', // 白天（明亮）
  dusk: 'dark', // 黃昏（暖色夕陽，深）
  night: 'dark' // 夜晚（深邃）
}

export function isSeason(v: unknown): v is Season {
  return typeof v === 'string' && (SEASONS as string[]).includes(v)
}

export function isDaypart(v: unknown): v is Daypart {
  return typeof v === 'string' && (DAYPARTS as string[]).includes(v)
}

// 月份（1–12）→ 季節（北半球）
export function getSeason(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter' // 12, 1, 2
}

// 小時（0–23）→ 時段
export function getDaypart(hour: number): Daypart {
  if (hour >= 5 && hour < 9) return 'dawn'
  if (hour >= 9 && hour < 17) return 'day'
  if (hour >= 17 && hour < 19) return 'dusk'
  return 'night' // 19–23, 0–4
}

// 以指定時區把 Date 換算成 { season, daypart }。
// 預設 Asia/Taipei：教室都在台灣（UTC+8），SSR（Cloudflare 為 UTC）與瀏覽器算出同一結果 → 換色不閃。
export function nowParts(date: Date, timeZone = 'Asia/Taipei'): { season: Season, daypart: Daypart } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'numeric',
    hour: 'numeric',
    hour12: false
  }).formatToParts(date)
  const month = Number(parts.find(p => p.type === 'month')?.value ?? '1')
  let hour = Number(parts.find(p => p.type === 'hour')?.value ?? '0')
  if (hour === 24) hour = 0 // hour12:false 午夜某些環境回 24
  return { season: getSeason(month), daypart: getDaypart(hour) }
}

// 把季節 + 時段組合成完整主題設定。未來加天氣：多一個入參並在此微調回傳值。
export function resolveTheme(input: { season: Season, daypart: Daypart }): ResolvedTheme {
  const { season, daypart } = input
  return {
    season,
    daypart,
    primary: SEASON_COLORS[season].primary,
    neutral: SEASON_COLORS[season].neutral,
    mode: DAYPART_MODE[daypart]
  }
}
```

- [ ] **Step 2: 寫一次性斷言腳本（驗證邊界正確）**

寫到 scratchpad（不進 git）：`check-seasons.mjs`

```js
import assert from 'node:assert/strict'
import { getSeason, getDaypart, nowParts, resolveTheme } from '/home/tim/githubRepo/amway/course-schedule/shared/utils/seasons.ts'

// 季節邊界
assert.equal(getSeason(3), 'spring')
assert.equal(getSeason(5), 'spring')
assert.equal(getSeason(6), 'summer')
assert.equal(getSeason(8), 'summer')
assert.equal(getSeason(9), 'autumn')
assert.equal(getSeason(11), 'autumn')
assert.equal(getSeason(12), 'winter')
assert.equal(getSeason(1), 'winter')
assert.equal(getSeason(2), 'winter')

// 時段邊界
assert.equal(getDaypart(4), 'night')
assert.equal(getDaypart(5), 'dawn')
assert.equal(getDaypart(8), 'dawn')
assert.equal(getDaypart(9), 'day')
assert.equal(getDaypart(16), 'day')
assert.equal(getDaypart(17), 'dusk')
assert.equal(getDaypart(18), 'dusk')
assert.equal(getDaypart(19), 'night')
assert.equal(getDaypart(0), 'night')

// resolveTheme 對應
const t = resolveTheme({ season: 'autumn', daypart: 'dusk' })
assert.deepEqual(t, { season: 'autumn', daypart: 'dusk', primary: 'orange', neutral: 'stone', mode: 'dark' })

// nowParts 用固定時區（台灣 UTC+8）：2026-01-15T02:00Z = 台灣 10:00 → winter/day
const parts = nowParts(new Date('2026-01-15T02:00:00Z'))
assert.deepEqual(parts, { season: 'winter', daypart: 'day' })

// 2026-07-15T13:00Z = 台灣 21:00 → summer/night
assert.deepEqual(nowParts(new Date('2026-07-15T13:00:00Z')), { season: 'summer', daypart: 'night' })

console.log('OK: all season/daypart assertions passed')
```

- [ ] **Step 3: 執行斷言腳本，確認全數通過**

Run:
```bash
just wrangler --version >/dev/null 2>&1; \
PATH="$HOME/.local/share/fnm/node-versions/v24.17.0/installation/bin:$PATH" \
node "/tmp/claude-1001/-home-tim-githubRepo-amway-course-schedule/036135b6-11d5-445f-9881-80392237d871/scratchpad/check-seasons.mjs"
```
Expected: `OK: all season/daypart assertions passed`
（node v24 原生可跑 `.ts`；若該環境不支援，改用 `node --experimental-strip-types`。）

- [ ] **Step 4: typecheck + lint**

Run: `just typecheck && just lint`
Expected: 皆通過，無 error。

- [ ] **Step 5: Commit**

```bash
git add shared/utils/seasons.ts
git commit -m "feat: 新增季節/時段主題判定單一來源 (spec 0018)"
```

---

### Task 2: 執行期套用（composable + plugin + config 調整）

讓當前主題的 primary/neutral 色盤與深/淺色實際套到畫面；支援 `?season=`/`?daypart=` 強制指定（供驗證）；跨過時段邊界自動更新。**此任務不含背景漸層**（Task 3）。

**Files:**
- Create: `app/composables/useSeasonalTheme.ts`
- Create: `app/plugins/seasonal-theme.ts`
- Modify: `nuxt.config.ts:16-22`（colorMode 區塊）
- Modify: `app/app.config.ts`（預設色 + 註解）

**Interfaces:**
- Consumes（Task 1）：`nowParts`、`resolveTheme`、`isSeason`、`isDaypart`、型別 `Season`/`Daypart`/`ResolvedTheme`（皆自動匯入）。
- Produces：
  - `function useSeasonalTheme(): { theme: ComputedRef<ResolvedTheme>; now: Ref<number>; apply: () => void; applyMode: () => void }`

- [ ] **Step 1: 建立 composable `app/composables/useSeasonalTheme.ts`**

```ts
// 依當前時間（或網址 query 強制值）解析主題，並套用到 Nuxt UI 的 appConfig.ui.colors 與 colorMode。
// now 為反應式時間戳，由 plugin 定時更新，跨過季節/時段邊界時自動重算。
// 型別／函式（Season, Daypart, ResolvedTheme, nowParts, resolveTheme, isSeason, isDaypart）皆由 shared/ 自動匯入。
export function useSeasonalTheme() {
  const appConfig = useAppConfig()
  const colorMode = useColorMode()
  const route = useRoute()

  // SSR 用當下時間初始化，payload 帶到 client（不重取）→ 首屏一致不閃。
  const now = useState<number>('cs-now', () => Date.now())

  // 網址 query 強制指定（僅供截圖驗證，非使用者 UI）：?season=autumn&daypart=dusk
  const forced = computed(() => ({
    season: isSeason(route.query.season) ? (route.query.season as Season) : null,
    daypart: isDaypart(route.query.daypart) ? (route.query.daypart as Daypart) : null
  }))

  const theme = computed<ResolvedTheme>(() => {
    const auto = nowParts(new Date(now.value))
    return resolveTheme({
      season: forced.value.season ?? auto.season,
      daypart: forced.value.daypart ?? auto.daypart
    })
  })

  // 套用 primary/neutral（改 appConfig，SSR 就生效、accent 不閃）
  function applyColors(): void {
    appConfig.ui.colors.primary = theme.value.primary
    appConfig.ui.colors.neutral = theme.value.neutral
  }

  // 套用深/淺（交給 color-mode）
  function applyMode(): void {
    colorMode.preference = theme.value.mode
  }

  function apply(): void {
    applyColors()
    applyMode()
  }

  return { theme, now, apply, applyMode }
}
```

- [ ] **Step 2: 建立 plugin `app/plugins/seasonal-theme.ts`（通用，非 .client）**

```ts
// 啟動即套用季節/時段主題；client 端定時 + 重新聚焦時更新，跨邊界自動切換。
// 注意：@nuxtjs/color-mode 會在 app:mounted 依 cookie 重設 preference，故掛載後再補套一次 mode（見 spec 0016）。
export default defineNuxtPlugin((nuxtApp) => {
  const { theme, now, apply, applyMode } = useSeasonalTheme()

  // SSR + client 啟動都先套一次（primary/neutral 於 SSR 就正確）
  apply()

  // color-mode 掛載時會覆寫 preference，nextTick 後補套我們的 mode
  nuxtApp.hook('app:mounted', () => {
    nextTick(() => applyMode())
  })

  if (import.meta.client) {
    const tick = () => {
      now.value = Date.now()
    }
    const timer = setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)

    // 時間變動 → theme 重算 → 重新套用
    watch(theme, () => apply())

    // HMR 清理，避免開發時累積 listener/timer
    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        clearInterval(timer)
        document.removeEventListener('visibilitychange', tick)
        window.removeEventListener('focus', tick)
      })
    }
  }
})
```

- [ ] **Step 3: 調整 `nuxt.config.ts` 的 colorMode 區塊**

把第 16–22 行（原本 `// 全站固定深色…` 到 colorMode 物件結尾）改為：

```ts
  // 深/淺色由「季節×時段」主題於執行期驅動（app/plugins/seasonal-theme.ts）。
  // 這裡的 preference/fallback 僅為首屏 fallback；storage 用 cookie 讓已造訪者 SSR 就渲染正確深/淺。
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
    storage: 'cookie',
    storageKey: 'cs-color-mode'
  },
```

- [ ] **Step 4: 調整 `app/app.config.ts` 預設色與註解**

整檔改為：

```ts
export default defineAppConfig({
  ui: {
    // 首屏 fallback 色盤；實際 primary/neutral 由「季節×時段」主題於執行期覆寫
    // （app/composables/useSeasonalTheme.ts）。深/淺見 nuxt.config.ts 的 colorMode。
    colors: {
      primary: 'indigo',
      neutral: 'slate'
    }
  }
})
```

- [ ] **Step 5: typecheck + lint**

Run: `just typecheck && just lint`
Expected: 皆通過。

- [ ] **Step 6: 瀏覽器實測（色盤 + 深淺 + 強制 query）**

啟動：`just dev`（背景執行；首次載入 Vite 需編譯，耐心等）。用 chrome-devtools MCP 或 headless chrome：
1. 開 `http://localhost:3000/?season=spring&daypart=day` → 主色為粉紅、**淺色**背景（Nuxt UI 卡片為白）。
2. 開 `http://localhost:3000/?season=winter&daypart=night` → 主色靛藍、**深色**背景。
3. 開 `http://localhost:3000/?season=autumn&daypart=dusk` → 主色橘、深色。
4. 不帶 query → 依當下台灣時間（2026-07 為 summer；依現在小時決定時段）。
截圖確認按鈕/連結 accent 顏色與深淺正確切換，且切換頁面不閃回舊色。

- [ ] **Step 7: Commit**

```bash
git add app/composables/useSeasonalTheme.ts app/plugins/seasonal-theme.ts nuxt.config.ts app/app.config.ts
git commit -m "feat: 依季節/時段自動套用色盤與深淺色 (spec 0018)"
```

---

### Task 3: 整頁季節氛圍漸層（16 組背景）

在 `<html>` 掛 `data-season`/`data-daypart`，`main.css` 依這兩屬性選出 16 組整頁背景漸層，鋪在 `<html>` 上、`<body>` 透明讓漸層透出、卡片維持不透明。

**Files:**
- Modify: `app/app.vue`（script setup 加 `useHead` htmlAttrs）
- Modify: `app/assets/css/main.css`

**Interfaces:**
- Consumes（Task 2）：`useSeasonalTheme().theme`（含 `season`/`daypart`）。

- [ ] **Step 1: `app/app.vue` — 在 `<script setup>` 內（既有程式碼之後、`useHead(...)` 之前或之後皆可）加入**

```ts
// 季節/時段掛到 <html> 屬性，供 main.css 選背景漸層（SSR 就寫入）
const { theme: seasonalTheme } = useSeasonalTheme();
useHead({
  htmlAttrs: {
    "data-season": computed(() => seasonalTheme.value.season),
    "data-daypart": computed(() => seasonalTheme.value.daypart),
  },
});
```

- [ ] **Step 2: `app/assets/css/main.css` — 在 `@theme static { ... }` 之後追加背景漸層層**

```css
/* ── 季節 × 時段 整頁背景漸層（氛圍層，spec 0018）──
   漸層鋪在 <html>、固定不隨捲動；<body> 透明讓漸層透出，Nuxt UI 卡片維持自身不透明背景。
   深/淺色文字對比由 color-mode 的 .dark 機制處理，與此漸層的明暗一致（清晨/白天=淺、黃昏/夜晚=深）。 */
:root {
  --app-bg: linear-gradient(160deg, #0f172a, #020617); /* fallback（冬夜） */
}
html {
  background: var(--app-bg) fixed;
  min-height: 100%;
}
body {
  background-color: transparent;
}

/* 春 spring：櫻粉 / 嫩綠 */
:root[data-season="spring"][data-daypart="dawn"] { --app-bg: linear-gradient(160deg, #fdf2f8, #ecfccb); }
:root[data-season="spring"][data-daypart="day"] { --app-bg: linear-gradient(160deg, #fce7f3, #f0fdf4); }
:root[data-season="spring"][data-daypart="dusk"] { --app-bg: linear-gradient(160deg, #831843, #4c1d3d 55%, #1e1b4b); }
:root[data-season="spring"][data-daypart="night"] { --app-bg: linear-gradient(160deg, #2e1065, #0f172a); }

/* 夏 summer：晴藍 / 青碧 */
:root[data-season="summer"][data-daypart="dawn"] { --app-bg: linear-gradient(160deg, #e0f2fe, #fef9c3); }
:root[data-season="summer"][data-daypart="day"] { --app-bg: linear-gradient(160deg, #dbeafe, #ecfeff); }
:root[data-season="summer"][data-daypart="dusk"] { --app-bg: linear-gradient(160deg, #0c4a6e, #7c2d12 60%, #1e1b4b); }
:root[data-season="summer"][data-daypart="night"] { --app-bg: linear-gradient(160deg, #082f49, #020617); }

/* 秋 autumn：琥珀 / 楓橘 */
:root[data-season="autumn"][data-daypart="dawn"] { --app-bg: linear-gradient(160deg, #fff7ed, #fef3c7); }
:root[data-season="autumn"][data-daypart="day"] { --app-bg: linear-gradient(160deg, #ffedd5, #fefce8); }
:root[data-season="autumn"][data-daypart="dusk"] { --app-bg: linear-gradient(160deg, #b45309, #7c2d12 55%, #1e1b4b); }
:root[data-season="autumn"][data-daypart="night"] { --app-bg: linear-gradient(160deg, #292524, #0c0a09); }

/* 冬 winter：靛藍 / 雪白 */
:root[data-season="winter"][data-daypart="dawn"] { --app-bg: linear-gradient(160deg, #eef2ff, #f8fafc); }
:root[data-season="winter"][data-daypart="day"] { --app-bg: linear-gradient(160deg, #e0e7ff, #f1f5f9); }
:root[data-season="winter"][data-daypart="dusk"] { --app-bg: linear-gradient(160deg, #312e81, #1e293b); }
:root[data-season="winter"][data-daypart="night"] { --app-bg: linear-gradient(160deg, #1e1b4b, #020617); }
```

- [ ] **Step 3: typecheck + lint**

Run: `just typecheck && just lint`
Expected: 皆通過。

- [ ] **Step 4: 瀏覽器實測（16 組漸層 + 可讀性）**

`just dev` 下逐一開下列網址截圖，確認整頁背景漸層隨組合改變、且卡片文字清晰可讀：
- 代表組合：`?season=autumn&daypart=dusk`（暖色夕陽）、`?season=winter&daypart=night`（雪夜深藍）、`?season=spring&daypart=day`（清透櫻粉）、`?season=summer&daypart=dawn`（晨光天藍）。
- 至少各季一組 light（dawn/day）與一組 dark（dusk/night），共檢查 ≥8 組。
- **可讀性重點**：確認 `<body>` 透明後漸層有透出（背景不是純白/純黑），且 `index`（FullCalendar）、`crm`、`equipment` 頁的卡片/表格底色仍不透明、文字對比足夠。
- 若某包裹層仍蓋住漸層（背景沒透出）：用 devtools 找出該不透明元素（可能是 `#__nuxt` 或 UApp 根），在 main.css 針對它加 `background-color: transparent;`。

- [ ] **Step 5: Commit**

```bash
git add app/app.vue app/assets/css/main.css
git commit -m "feat: 季節×時段整頁背景漸層氛圍層 (spec 0018)"
```

---

## Self-Review

**1. Spec coverage（對照 `specs/0018`）：**
- 季節/時段判定（Asia/Taipei）→ Task 1 `getSeason`/`getDaypart`/`nowParts`。✔
- 季節→primary/neutral 色調 → Task 1 `SEASON_COLORS`、Task 2 套用。✔
- 時段→深淺 → Task 1 `DAYPART_MODE`、Task 2 `applyMode`。✔
- 16 組整頁氛圍漸層 → Task 3 `main.css`。✔
- `resolveTheme` 擴充點 → Task 1（入參物件，易加 `weather`）。✔
- 反應式更新 + color-mode 掛載補套 → Task 2 plugin。✔
- `?season/?daypart` 驗證用強制值 → Task 2 composable。✔
- 不動 DB、無切換 UI、無裝飾動畫 → 計畫未含，符合 YAGNI。✔
- nuxt.config colorMode 不再寫死 dark、app.config 預設更新 → Task 2 Step 3/4。✔

**2. Placeholder scan：** 無 TBD/TODO；所有 code step 皆含完整程式碼。✔

**3. Type consistency：** `Season`/`Daypart`/`ResolvedTheme`、`resolveTheme({season,daypart})`、`nowParts(date,timeZone?)`、`useSeasonalTheme()` 回傳 `{theme, now, apply, applyMode}` 在 Task 1→2→3 一致；`applyColors` 為 composable 內部函式（不對外）。✔

**已知取捨（實作時留意，非阻塞）：**
- 首次造訪（無 cookie）若當下為淺色時段，color-mode fallback=dark 可能造成一次性深→淺閃動；已造訪者靠 cookie 不閃。可接受；Task 2 Step 6 觀察，如嚴重再議。
- `body` 透明策略若被某包裹層擋住，Task 3 Step 4 有排查指引。
