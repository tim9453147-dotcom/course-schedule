# 0023 — AI 辨識 prompt 由超級管理員線上調整

## 目標

把課表圖片辨識（`POST /api/events/ai-extract`，見 specs/0013）用的 Gemini prompt 從**寫死在程式碼**改成**超級管理員可在 `/admin` 線上編輯**，不必改 code、不必重新部署。改壞了可一鍵還原預設。

## 現況

prompt 目前是 `server/api/events/ai-extract.post.ts` 內組出的字串陣列（含動態 `${year}` 代入當年）。`settings` 表（key/value/updatedAt，migration 0015 已建）目前未使用。`/admin` 已於 `app/middleware/auth.global.ts` 全頁鎖定超管，後端各 API 另以 `requireSuperAdmin` 把關。

## 設計

### 共用預設 prompt

新增 `shared/utils/aiPrompt.ts`，匯出：

- `AI_EXTRACT_PROMPT_KEY = 'ai_extract_prompt'`（`settings` 表的 key）。
- `DEFAULT_AI_EXTRACT_PROMPT`：現有那段 prompt 原文，唯一差別是把動態的 `${year}` 改成字面佔位符 **`{{year}}`**（因為預設值是靜態字串，年份於執行期才代入）。

`shared/` 前後端自動匯入：後端當 fallback、前端「還原預設」用。

### 後端

**`GET /api/settings/ai-extract-prompt.get.ts`**
- `await requireSuperAdmin(event)`。
- 讀 `settings` 表 `AI_EXTRACT_PROMPT_KEY`；有值回該值、否則回 `DEFAULT_AI_EXTRACT_PROMPT`。
- 回傳 `{ prompt: string }`。

**`PUT /api/settings/ai-extract-prompt.put.ts`**
- `await requireSuperAdmin(event)`。
- body `{ prompt: string }`；`prompt.trim()`：
  - 空字串 → 刪除該 `settings` 列（等同回到預設）。
  - 非空 → upsert（`insert ... onConflictDoUpdate` key=`AI_EXTRACT_PROMPT_KEY`，一併更新 `updatedAt`）。
- 回傳 `{ ok: true }`。

**改 `server/api/events/ai-extract.post.ts`**
- 取代寫死的 prompt 組裝：先讀 `settings` 的有效 prompt（無則 `DEFAULT_AI_EXTRACT_PROMPT`），再 `effective.replaceAll('{{year}}', String(year))` 得到送給 Gemini 的最終字串。
- 其餘（`requirePage('calendar')`、圖片檢查、`responseSchema`、Gemini 呼叫與錯誤處理、原樣回傳 `{ text }`）**完全不動**。
- 注意 `useDb(event)` 讀取；辨識路由本就需要 DB binding。

### 前端 `/admin`

在既有使用者管理內容外，新增一個「AI 辨識設定」區塊（`/admin` 已鎖超管，無需另加前端 gate；後端仍為權威）：

- 進頁以 `useFetch('/api/settings/ai-extract-prompt')` 載入現值到一個 ref。
- 等寬字體 `UTextarea`（約 14 行、可捲動）綁該 ref。
- 說明文字：`{{year}}` 會在辨識時自動代入當年年份。
- 按鈕：
  - **儲存** → `PUT`，成功 toast；沿用 `useNotify`。
  - **還原預設** → 把文字框內容設回 `DEFAULT_AI_EXTRACT_PROMPT`（**尚未存**，提示使用者確認後按儲存）。

## 不做

- 不讓一般 DB 使用者編輯（僅超管）。
- 不改 `NUXT_GEMINI_MODEL` 等其他設定（本次只做 prompt）。
- 不新增 migration（`settings` 表已存在）。

## 驗證

沿用 headless Chrome / Playwright 對 `bun dev`：

1. 超管登入進 `/admin` → 見「AI 辨識設定」區塊、文字框已載入預設 prompt。
2. 改幾個字按儲存 → 重整後仍是改後內容（`GET` 回傳已更新）。
3. 按「還原預設」→ 文字框變回預設；儲存後 `GET` 回預設；DB 對應列被刪或存回預設。
4. 直接打 `GET/PUT /api/settings/ai-extract-prompt`（非超管 / 未登入）→ 403/401，確認後端把關。
5. `POST /api/events/ai-extract`（若有 Gemini key）實際跑一張圖，確認改後 prompt 生效且 `{{year}}` 已代入；無 key 時route 仍照舊回 500（不影響手動貼上匯入）。
6. `bun run typecheck` / `bun run lint`：改動檔案 0 錯。
