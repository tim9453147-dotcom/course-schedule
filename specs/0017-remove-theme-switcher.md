# 0017 — 移除全站色系主題切換，固定石墨黑

## 背景

spec `0016` 加了「全站色系主題」功能：超級管理員可在 header 下拉切換 13 種色系，
選取後存進 DB（`settings` 表 `key='theme'`），所有使用者共用。

需求變更：目前只保留預設「石墨黑」，移除主題切換 UI 與相關程式碼。
（日後會再加色系，故**保留** `settings` 資料表以便重用。）

## 決定

- 石墨黑 = `primary: zinc` / `neutral: neutral` / 深色，已寫死於 `app/app.config.ts`
  與 `nuxt.config.ts`（`colorMode.preference: 'dark'`）。移除主題系統後 App 永久停在石墨黑，
  這兩處不需改動邏輯，只更新過時註解。
- DB `settings` 表**保留**（通用鍵值表，日後加色系可重用），僅移除讀寫它的 theme API。
  不產生 migration、不動遠端 D1。

## 變更

刪除：
- `app/composables/useTheme.ts`
- `app/plugins/theme.ts`
- `shared/utils/themes.ts`（`THEMES` / `ThemeId` / `isThemeId` / `DEFAULT_THEME`）
- `server/api/settings/theme.get.ts`
- `server/api/settings/theme.put.ts`

編輯：
- `app/app.vue` — 移除 header 主題下拉（script 的 `useTheme`/`pickTheme`/`themeItems`
  與 template 的 `UDropdownMenu`）。
- `app/app.config.ts`、`nuxt.config.ts`、`server/db/schema.ts` — 更新提及主題切換的過時註解。

## 驗證

`bun run typecheck` + `bun run lint` 通過；`bun dev` 下 header 不再有主題按鈕，畫面維持石墨黑深色。
