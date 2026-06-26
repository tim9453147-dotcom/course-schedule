# 0013 — 上傳課表圖片，用 Gemini 自動辨識成匯入 JSON

## 背景

0012 已把匯入改成「貼上日期制 JSON → 預覽 → 匯入」。但 JSON 仍要使用者自己拿圖片去外部 AI 轉。本版讓使用者直接在 App 內上傳課表圖片，由後端呼叫 **Gemini（免費方案 `gemini-2.5-flash`）** 辨識成同一份日期制 JSON，自動填進匯入預覽框。

設計原則：**AI 只產生 JSON 草稿填進預覽，不直接寫資料庫**。沿用 0012 的解析預覽 → 確認 → `POST /api/events/import` 流程，辨識錯誤（尤其中文人名）在預覽這關就能改/擋。

為什麼選 Gemini：免費方案涵蓋 Flash 系列，`gemini-2.5-flash` 支援讀圖 + 強制 JSON 輸出；免費額度約 10 RPM / 250 RPD / 250K TPM（查證 2026-06），偶爾匯入足夠。用 REST 直接打，不裝 SDK（Cloudflare Workers 相容性最穩）。

## JSON 格式

完全沿用 0012 的 `eventImportItemSchema`：`title`(必)、`date`(必，`YYYY-MM-DD`)、`startTime`/`endTime`、`host`/`sharer`/`summarizer`/`pm`、`location`、`note`。`kind` 不需要（匯入一律 `course`）；教室由匯入畫面選。

## 後端

新增 `server/api/events/ai-extract.post.ts`：

- `requirePage(event,'calendar')`。
- body：`{ imageBase64, mimeType, defaultYear }`（base64 不含 `data:` 前綴）。
- `useRuntimeConfig` 取 `geminiApiKey`（空 → 500「尚未設定 Gemini API key」）、`geminiModel`（預設 `gemini-2.5-flash`）。
- 防呆：`mimeType` 須 `image/*`、`imageBase64` 非空。
- POST `https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent`，header `x-goog-api-key`，body：
  - `contents[0].parts = [{ text: PROMPT }, { inlineData: { mimeType, data: imageBase64 } }]`
  - `generationConfig.responseMimeType = 'application/json'`
  - `generationConfig.responseSchema`：`ARRAY` of `OBJECT`，properties 全 `STRING`，`required: ['title','date']`。
- PROMPT 辨識規則：
  1. 只擷取課程內容，佈置／頁首頁尾等非課程資訊忽略；「DST」也是一堂課須列出。
  2. 角色欄位要擷取：縮寫「H」＝主持→`host`、「C」＝總結→`summarizer`；有「分享」→`sharer`、「PM」→`pm`，沒有就留空。
  3.「值星小組」是另一區塊，整塊忽略、不放進任何欄位（且不影響 H/C 等角色擷取）。
  4. `date` 缺年份時用傳入的 `defaultYear`。
  5. `startTime`：有寫用寫的；沒寫時 DST→18:30、週一至週五→19:30、週末/無法判斷留空。
  6. `endTime` 有寫才用、不自行推算；`location` 依課表標題/表頭、個別沒標就留空；`note` 沒寫留空。
  7. 只輸出 JSON 陣列。
- 取 `candidates[0].content.parts[0].text`，原樣回 `{ text }`。
- 錯誤：429 → 429「AI 服務忙碌或已達免費上限」；其他非 200 / 連線失敗 → 502；無 candidates → 422。

設定：`nuxt.config.ts` runtimeConfig 加 `geminiApiKey`/`geminiModel`；`.env.example` 加 `NUXT_GEMINI_API_KEY`。免 migration。

## 前端（`app/pages/index.vue` 匯入視窗）

- 新增 `aiLoading`、隱藏 `<input type="file" accept="image/*">`（`useTemplateRef('aiFileInput')`）。
- JSON 文字框上方加「上傳課表圖片，自動辨識」按鈕（`v-if="canEdit"`、`:loading="aiLoading"`）。
- `onAiImage`：
  1. `shrinkImage()` 用 canvas 把圖縮到長邊 ≤ 1600px、轉 `image/jpeg` base64（降低 token/上傳量；純前端）。
  2. `POST /api/events/ai-extract`，body `{ imageBase64, mimeType:'image/jpeg', defaultYear }`。
  3. 成功 → `importText.value = text`（觸發既有 `importParsed` → 預覽顯示）→ toast「已辨識 N 筆，請核對」。
  4. 失敗 → toast 錯誤；清空 file input。
- **不新增匯入路徑**：辨識結果只是填進現有文字框，後續完全沿用 0012。

## 金鑰 / 部署

- 本機：`.env` 填 `NUXT_GEMINI_API_KEY`（https://aistudio.google.com 免費申請）。
- Cloudflare：Pages secret `NUXT_GEMINI_API_KEY`，**下次部署才生效**。
- 沒 key 時：上傳會回 500，手動貼 JSON 不受影響。

## 不在本版範圍

- 一次多張圖片、PDF/多頁。
- 後端伺服器端壓縮（目前在前端縮圖）。
- 換模型 UI（用 `NUXT_GEMINI_MODEL` 環境變數即可）。

## 驗證

1. `typecheck` / `lint` 不新增錯誤。
2. 填入有效 key 後 `bun dev`，登入 → 對 `/api/events/ai-extract` 丟一張課表圖 base64 → 回合法 JSON 陣列字串。
3. 瀏覽器：匯入視窗上傳圖片 → 預覽自動填入 → 核對 → 確認匯入 → 月曆出現。
4. 未設 key → 500；手動貼 JSON 仍正常。
