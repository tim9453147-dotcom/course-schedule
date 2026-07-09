# 0019 — 超級管理員主題預覽面板（手動覆寫季節/時段）

## 背景

spec `0018` 讓主題依當下季節/時段自動切換。需求追加：超級管理員想能**手動預覽**任一組合
（檢查各季節時段長怎樣），在畫面上多一個設定按鈕，點開小面板調整。

## 決定

- **只影響超級管理員自己的瀏覽器**（純前端預覽，**不碰 DB、不加 API、不出 migration**）。
  其他使用者不受影響，仍依當下時間自動顯示。
- 覆寫為 client 端狀態，關閉分頁即失效（除非用網址 query）。原 `?season=&daypart=` 驗證後門
  改為「覆寫狀態的初始值」，行為不變。
- 觸發方式：header 右側一顆按鈕（限超級管理員可見），點開 `UPopover` 小面板。
  （不用鍵盤快捷鍵、不叫「工程模式」。）

## 變更

編輯 `app/composables/useSeasonalTheme.ts`：
- 以 `useState('cs-theme-override', …)` 存 `override = { season: Season|null, daypart: Daypart|null }`，
  初始值沿用網址 `?season=/?daypart=`。
- `theme` 解析順序：`override → 依時間自動`。
- 新增 `auto`（computed，供面板顯示「目前自動為」）、`setSeason()`、`setDaypart()`、`resetAuto()`
  並一併回傳。plugin 既有的 `watch(theme)` 會自動重繪，無需改 plugin。

新增 `app/components/SeasonThemePanel.vue`：
- 一顆齒面板按鈕（icon `i-lucide-palette`，文字「主題」）+ `UPopover`。
- 面板內：季節列（春/夏/秋/冬）、時段列（清晨/白天/黃昏/夜晚），選中者實心 primary 高亮、
  其餘 outline；顯示「目前自動為：○○・○○」；底部「回到自動」（`resetAuto`，自動狀態時 disabled）。
- 純前端，點選即時套用。

編輯 `app/app.vue`：
- header `#right` 最前面加 `<SeasonThemePanel v-if="isSuper" />`。非超級管理員看不到。

## 驗證

- 超級管理員登入 → 右上出現「主題」按鈕 → 點開面板 → 點季節/時段 → 全站即時變色與深淺、
  背景漸層跟著換 → 「回到自動」恢復依時間顯示。
- 一般使用者／未登入 → 看不到該按鈕，主題維持依時間自動。
- `bun run typecheck` 不新增錯誤；新檔 lint 乾淨。
