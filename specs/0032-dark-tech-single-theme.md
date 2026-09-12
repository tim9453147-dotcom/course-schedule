# 0032 — Dark Tech 單一風格（取代季節主題，保留深淺切換）

## 背景

本站長期採用「季節×時段」自動主題（spec 0018–0020）並疊加「黑色科技 dark_modern」全站切換（spec 0026）。與 `/Users/tim/githubRepo/presentation` 的自製簡報主題 `slidev-theme-tech`（Dark Tech：zinc-950 底、emerald 主色、sky 強調、玻璃卡片、格線與環境光暈）對齊後，決定**全站改採單一 Dark Tech 風格**，移除季節子系統。

考量使用者仍需深/淺偏好，本次保留深淺切換（對比簡報主題的純深色），以 Nuxt UI 的 `.dark` 機制 + header 一鍵切換鈕實作。

## 決定

1. **移除季節子系統**（相關規格 0016/0018/0019/0020/0026 的主題部分至此作廢）：
   - `shared/utils/seasons.ts`、`app/composables/useSeasonalTheme.ts`、`app/plugins/seasonal-theme.ts`、`app/components/SeasonThemePanel.vue`
   - `server/api/settings/theme.get.ts` / `theme.put.ts`（D1 `settings` 表中的 `site_theme` 列留置不讀，免遷移）
   - `main.css` 的季節漸層、舊暖灰 `dark-modern` 覆寫區塊

2. **Dark Tech 視覺語彙**（移植自 `slidev-theme-tech`）：
   - 主色 emerald（`#10b981`）、強調 sky（`#38bdf8`）；neutral 色盤 `zinc`
   - 深色 mode：`--app-bg` zinc-950→900→950 漸層；表面玻璃感（近透明白 3–6% + `white/10` 級邊框）；文字 zinc 階
   - 淺色 mode（對應設計，簡報主題沒有提供）：zinc-50 白底、白面卡片細邊框，格線/光暈降為極淡版本
   - 兩 mode 共用的氛圍層：右上 emerald／左下 blue 環境光暈（fixed、`pointer-events: none`）。簡報主題的 40px 格線 overlay 在應用程式背景过于搶眼，經確認不移植。
   - `html` 掛 `data-theme="dark-tech"`（靜態）

3. **深淺切換**：
   - `nuxt.config.ts` colorMode 維持 cookie 持久化（`cs-color-mode`），預設 dark
   - header 右側掛 `<UColorModeButton>`，一鍵切換深/淺
   - 保留 View Transitions 交叉淡入過渡（spec 0020 的 CSS，切換深淺時仍適用）

4. **不动的部分**：
   - 排程事件色板（`COLOR_OPTIONS`/`COLOR_HEX`）是使用者資料，維持原樣
   - FullCalendar 樣式已走 `--ui-border`/`--ui-primary` 語意變數，隨 token 自動換裝

## 驗證

`just lint`、`just typecheck`，`just dev` 逐頁（排程/家聚/CRM/每日任務/器材/使用者管理）深淺兩模式各過一輪，含手機版。
