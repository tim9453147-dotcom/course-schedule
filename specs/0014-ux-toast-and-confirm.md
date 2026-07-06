# 0014 — 統一提示訊息 UX（toast 加 icon + 確認對話框取代原生 confirm）

## 動機

「做完動作之後的提示訊息很醜」，實際有兩個問題：

1. **成功／失敗 toast** 散在各頁，全部只給 `title`＋`color`，沒有 icon、風格不一致、每頁各寫各的 `toast.add({...})`。
2. **刪除確認** 用瀏覽器原生 `window.confirm()`（7 處），字型／按鈕／位置完全不受控，跟 App 的 Nuxt UI 綠色風格脫節，是最刺眼的部分。

## 做法

### ① `useConfirm()` + `ConfirmDialog.vue`（取代原生 confirm）

- `app/components/ConfirmDialog.vue`：以 `useOverlay` 程式化開啟的 `UModal`。用 `defineModel('open')` 轉發給 UModal，確定／取消各 `emit('close', true|false)`；`danger` 時標題圖示與確定鈕轉紅。
- `app/composables/useConfirm.ts`：包 `useOverlay`，回傳 `confirm(options): Promise<boolean>`。
- 呼叫端：`if (!(await confirm({ title, description, danger: true }))) return`。
- OverlayProvider（已在 `<UApp>` 內）以 `v-model:open` 綁定元件、監聽 `@close` 來 resolve 承諾；使用者按 Esc／點遮罩關閉時視為取消（resolve `undefined`）。

### ② `useNotify()`（統一 toast：頂部置中膠囊）

- `app/composables/useNotify.ts`：包 `useToast`，提供 `success/error/info`，自動帶對應 icon（`i-lucide-circle-check` / `i-lucide-circle-alert` / `i-lucide-info`）。
- 各頁 `const toast = useToast()` → `const notify = useNotify()`，`toast.add({ title, color })` → `notify.success/error(title, description?)`。
- **呈現方式（使用者選定）**：頂部置中的膠囊。每則 toast 覆寫 `ui.root`：`w-fit mx-auto` 縮到內容寬、單行 `rounded-full`、有說明文字時 `rounded-2xl`；並 `close: false`。CJK 會逐字換行，故 `title`/`description` 加 `whitespace-nowrap`，`w-fit` 才量得到整行寬度。

### ③ `<UApp :toaster>`

- 在 `app.vue` 設定 toaster：`position: 'top-center'`、`progress: false`（不要進度條）、`duration: 3000`。

## 影響檔案

- 新增：`app/components/ConfirmDialog.vue`、`app/composables/useConfirm.ts`、`app/composables/useNotify.ts`
- 修改：`app/app.vue`、`app/pages/{index,crm,equipment,admin,login,apply}.vue`

## 不在範圍

- `admin.vue` 的 `window.prompt`（重設密碼輸入）暫留，之後可另做輸入對話框。

## 驗證

- `bun run typecheck`、`bun run lint` 通過。
- 手動：各頁儲存／刪除，toast 帶 icon；刪除跳出同風格紅色確認框，取消不刪、確定才刪。
