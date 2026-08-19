# 0026 — 黑色科技（VS Code Dark Modern）全站主題切換

## 背景

目前網站具備「季節時刻」風格（spec 0018），隨北半球四季月份與台灣時間時段自動變換整體色系與背景漸層，超級管理員亦可透過導覽列面板（spec 0019）進行本地預覽。

本規格新增「黑色科技（VS Code Dark Modern）」全站風格，並支援由超級管理員在介面上進行**全站主題切換**（儲存至資料庫，所有使用者與訪客即時生效）。

## 決定

1. **主題模式（`SiteTheme`）**：
   - 🌸 **季節時刻（`seasonal`）**：依真實時間自動切換四季與時段（春/夏/秋/冬 × 晨/日/昏/夜）。超級管理員可在面板內自選預覽或「回到自動」。
   - 💻 **黑色科技（`dark_modern`）**：以 VS Code Dark Modern 為基準：
     - `primary`: `sky`（經典 VS Code 編輯器高亮藍）
     - `neutral`: `zinc`（金屬深灰暗調）
     - `mode`: `dark`（強制深色模式）
     - 整頁背景：VS Code 經典深色編輯器漸層（`linear-gradient(180deg, #1e1e20 0%, #18181b 100%)`）
     - HTML 標籤掛 `data-theme="dark-modern"`

2. **全站持久化與權限**：
   - 寫入 D1 資料庫 `settings` 表（`key = 'site_theme'`, `value = 'seasonal' | 'dark_modern'`）。
   - `GET /api/settings/theme`：公開端點，供 SSR 及前端讀取當前全站主題。
   - `PUT /api/settings/theme`：限超級管理員（`requireSuperAdmin`），更新全站主題。

3. **管理員介面整合（`SeasonThemePanel.vue`）**：
   - 最上方提供「🌸 季節時刻」與「💻 黑色科技」一鍵切換。
   - 選「季節時刻」時下方展開季節與時段按鈕（供管理員本地預覽）。
   - 選「黑色科技」時下方顯示已啟用 Dark Modern 說明。
