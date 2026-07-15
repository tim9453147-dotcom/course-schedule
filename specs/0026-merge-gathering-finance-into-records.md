# 0026 — 合併家聚點「收支紀錄」與「活動紀錄」

## 任務目標

家聚點 `/gathering` 原本是三分頁：**收支紀錄**、**活動紀錄**、**食譜列表**。其中「收支紀錄」（`gathering-finance` 權限）與「活動紀錄」（public，`gathering` 權限可編輯）列出的是**完全相同的一批活動**，差別只在「能編輯哪些欄位」——收支分頁編輯人數/收費/支出，活動分頁編輯其餘欄位。清單重複、體驗割裂，故把收支折進活動明細、移除獨立的收支分頁。

## 最終設計決策

- **三分頁 → 兩分頁**：只留「活動紀錄」（預設）、「食譜列表」。收支不再是獨立分頁。
- **收支折進活動明細 modal**，以 `useCanEdit('gathering-finance')` 控管：有權限者才看得到、才能編輯；無權限者所見與原本相同。
- **資料流採「前端合併、後端幾乎不動」**（否決「讓 `/api/gatherings` 依權限夾帶收支」的方案）：
  - 公開的 `GET /api/gatherings` 回應**永遠不含收支欄位**，零洩漏風險。
  - 收支只經既有、已由 `requirePage(event, 'gathering-finance')` 守門的 `GET /api/gathering-finances` 取得；無權限者前端根本不發此請求（`immediate: canFinance.value`）。
  - 存收支沿用既有 `PUT /api/gathering-finances/:gatheringId`。
  - `gatherings` / `gathering_finances` 維持獨立表（延續「收支獨立表、乾淨隔離 private 權限」的既有設計），**不動 schema、無 migration**。
- **收支僅在「編輯既有活動」時出現**（`editingId` 有值）：新增活動時不顯示收支區塊 —— 先存活動、之後再進來補收支。
- **收支區塊可折疊、預設收合**；展開後即時預覽「收入（人數×收費）」「盈餘（收入−支出）」。
- **清單列盈餘徽章**：有 `gathering-finance` 權者，對**已填收支**的活動於列右側顯示盈餘（綠 +／紅 −）；未填收支（人數/收費/支出三者皆 null）的活動不顯示徽章。
- **權限解耦**：`gathering` 與 `gathering-finance` 是兩個獨立 key，可只授其一。只有 `gathering-finance`（無 `gathering`）者能單獨編輯/儲存收支，活動欄位對其維持唯讀 —— 保留合併前「收支可獨立編輯」的能力。

## 實作內容

純前端變更：

- `app/components/GatheringRecords.vue`
  - 新增 `canFinance = useCanEdit('gathering-finance')`；`canFinance` 為真時 `useFetch('/api/gathering-finances')` 取回每場活動 `{ headcount, fee, expense, income, profit }`，建 `financeById` map。
  - `financeOf(id)`：三欄皆 null 視為「未填」回傳 null，供清單徽章判斷（避免後端 leftJoin 讓未填活動也顯示「+0」）。清單以 `gatheringRows` computed 每列只查一次。
  - 明細 form 新增 `headcount/fee/expense`（字串存放）；`openRow` 由 map 帶入、`openCreate` 清空；`showFinance` 折疊狀態預設收合。
  - 明細 modal 於備註之後、`v-if="canFinance && editingId"` 顯示可折疊收支區塊（人數/收費/支出 + 即時預覽）。
  - `save()`：`canEdit` 才 POST/PUT `/api/gatherings`（活動的 name/date 驗證也只在此時做）；`canFinance && editingId` 才 PUT `/api/gathering-finances/:id`（空字串→null）。儲存鈕顯示條件 `canEdit || (canFinance && editingId)`。
- `app/pages/gathering.vue`：移除 `finance` 分頁與 `canFinance` 分頁組裝邏輯，預設分頁 `records`。
- **刪除** `app/components/GatheringFinance.vue`。
- `shared/utils/pages.ts`：更新「三分頁」過時註解為「兩分頁」（PAGES 陣列與順序不動）。
- **保留**所有 API 路由與 `server/db/schema.ts`（`GET /api/gathering-finances`、`PUT /api/gathering-finances/:gatheringId` 仍由活動紀錄使用）。

## 結果與驗證

以 SDD 流程分三 task 實作，每 task code review + 最終全分支 review（皆通過）。commits `798fd9c..5bca424`。

typecheck / lint：除既有基線 1 個無關錯誤（`app/pages/equipment.vue(342,22) TS2322`）外，無新增。

controller 於本機 `just dev`（D1）做 API / SSR 端到端驗證：

- 未登入 `GET /api/gathering-finances` → **401**（守門正確）。
- 公開 `GET /api/gatherings` 回應**完全不含收支欄位**（零洩漏）。
- 未登入 `/gathering` 只見「活動紀錄」單一分頁；admin 見「活動紀錄＋食譜列表」兩分頁、**無獨立收支分頁**。
- 清單徽章：已填收支的活動顯示盈餘（例 `+100` 綠）；未填的不顯示。
- 收支計算：PUT 人數10×收費200−支出500 → 收入 2000、盈餘 1500。
- 最終 review 抓到並修掉的 Important：`gathering-finance`-only 使用者原本存收支會撞 403 死路，已由 `save()` 解耦活動/收支兩步存檔修復。

## 後續事項

- 本機未安裝 playwright，故明細 modal 內「展開收支 → 填寫 → 儲存」的**互動**未用瀏覽器實點（其依賴的權限門控、PUT 回算、模板 `v-if`/預設收合皆已在 code review 與 API 層驗證）。日後若要補端到端點擊測試，需 `bunx playwright-core` 指向 `/usr/bin/google-chrome-stable`。
