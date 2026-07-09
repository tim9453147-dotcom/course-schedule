# 0020 — 主題切換平滑過渡（自動與手動皆淡入淡出）

## 背景

spec `0018`/`0019` 的主題切換（背景漸層、accent 色盤、深/淺色）目前是瞬間跳變。
需求：不論「依時間自動換季/換時段」或「超級管理員面板手動切換」，都要平滑過渡。

## 決定

- 用 **View Transitions API**（`document.startViewTransition`）做整頁交叉淡入淡出：一次過渡同時涵蓋
  背景漸層 + accent 色 + 深/淺色，不需在全站元素掛全域 CSS transition（避免干擾 FullCalendar 拖曳等互動與造成 jank）。
- **優雅降級**：瀏覽器不支援 `startViewTransition`，或使用者 `prefers-reduced-motion: reduce` 時，
  直接套用（維持 0018 的瞬間切換），不報錯。
- 過渡時長約 **0.5s**，以 CSS 設定 `::view-transition-old/new(root)`。
- 順帶修正 0018 的 `watch(theme)`：改成只在「解析後的 primary/neutral/mode 真的改變」時才套用，
  避免每 60 秒 tick 觸發無謂過渡。啟動時的首次套用與 `app:mounted` 補套 **不**走過渡。

## 變更

編輯 `app/plugins/seasonal-theme.ts`：
- 新增 `applyWithTransition()`：`prefers-reduced-motion` 或不支援 View Transitions ⇒ 直接 `apply()`；
  否則 `document.startViewTransition(() => { apply(); return nextTick() })`（`nextTick` 確保 Vue／unhead
  把新色盤、`.dark`、`data-season/daypart` 都刷進 DOM 後才擷取「新」快照）。
- 把 `watch(theme, () => apply())` 改為 watch **字串值鍵**
  `` () => `${theme.value.primary}|${theme.value.neutral}|${theme.value.mode}` ``，回呼改叫 `applyWithTransition()`。
  （用字串而非陣列：Vue 以 `Object.is` 比較，內容不變不觸發；陣列每次都是新參考會誤觸發，等於沒修好每分鐘 tick 的問題。）

編輯 `app/assets/css/main.css`：
- `::view-transition-old(root), ::view-transition-new(root) { animation-duration: .5s; }`
- `@media (prefers-reduced-motion: reduce)`：把 view-transition 動畫關掉（保險，與 JS 判斷雙保險）。

## 驗證

- `bun dev`＋超級管理員面板：切換季節/時段時，背景漸層與色盤、深/淺色**淡入淡出**（非瞬間）。
- DevTools 模擬 `prefers-reduced-motion: reduce`：切換恢復為瞬間、無動畫。
- `bun run typecheck` 不新增錯誤；改動檔 lint 乾淨。
