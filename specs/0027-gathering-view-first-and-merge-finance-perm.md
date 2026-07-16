# 0027 家聚點:活動明細檢視優先 + 收支權限併入活動權限

日期:2026-07-16

## 任務目標

家聚點「活動紀錄」原本點清單列即直接開啟完整編輯表單(無權者靠欄位 `disabled` 當唯讀)。兩個需求:

1. **檢視優先**:點清單列先看到精簡資訊檢視(時間、地點、流程、料理;點料理才展開作法),按「編輯」才進入編輯表單。
2. **權限合併**:把獨立的「編輯收支」權限 `gathering-finance` 併入「編輯活動」權限 `gathering`,不再分兩個 key。

## 最終設計決策

- **精簡 info 檢視只顯示四項**:時間(日期 + 起訖時間)、地點(有 `mapUrl` 附「開啟地圖」連結)、流程、料理(引用食譜名稱;點一下才展開食材/作法)。無值的欄位不顯示。**不顯示**操鍋/助手/採買、參加名單、備註、收支。
- **modal 以 `mode: 'view' | 'edit'` 切換**:點列 → `view`;「新增活動」→ `edit`。標題:`view`→「活動明細」、`edit` 新增→「新增活動」、`edit` 既有→「編輯活動」。
- **「編輯」按鈕只在 `mode==='view' && canEdit` 顯示**;無 `gathering` 權的純檢視者停在 `view`、無法進入表單。`edit` 為原有完整表單(含收支折疊區),邏輯不動。
- **權限單一化**:移除 `gathering-finance`,收支的讀取/編輯改由 `gathering` 控管。前端 `canFinance` 收斂為單一 `canEdit = useCanEdit('gathering')`。
- **既有資料不寫 migration**:合併後只授 `gathering-finance` 的使用者該 key 會被 `sanitizePages` 濾除,由超管在 `/admin` 重新勾 `gathering` 補回(D1 local/remote 分離、使用者數少)。
- 清單列的盈餘徽章保留,顯示條件改看 `canEdit`。

## 實作內容

分三段實作(commits `8ce2d0f`、`9c4253c`、`06fa339`,收尾修 `edb1981`):

- **後端 / 登記表**
  - `shared/utils/pages.ts`:刪除 `gathering-finance` 的 `PAGES` 項目(`gathering`、`gathering-recipe` 不動)。
  - `server/api/gathering-finances/index.get.ts`、`[gatheringId].put.ts`:守門 `requirePage` 由 `'gathering-finance'` 改為 `'gathering'`,同步更新中文註解。
  - `app/pages/gathering.vue`:清掉頂部過時的 `gathering-finance` 註解。

- **前端 `app/components/GatheringRecords.vue`**
  - 移除 `canFinance`,全部改用單一 `canEdit`;收支列表抓取 `immediate`、清單盈餘徽章、收支折疊區與其輸入、底部儲存鈕條件皆改看 `canEdit`。`save()` 移除「finance-only 使用者不打 /api/gatherings」的舊分支,合併後 `canEdit` 為真即一併存活動與收支。
  - 新增 `mode` ref 與 `modalTitle` computed;`openCreate()` 設 `edit`、`openRow()` 設 `view`。
  - 新增精簡 `view` 區塊(時間/地點/流程/料理,點料理沿用 `showRecipe`/`selectedRecipe` 展開食材與作法);原完整表單包進 `v-if="mode==='edit'"`;`view` 與 `edit` 為兄弟容器,底部按鈕列共用置於兩者之後。
  - 底部按鈕依模式:`view+canEdit`→「編輯」;`edit`→「儲存」;刪除鈕限 `edit && canEdit && editingId`;取消/關閉文案依模式。
  - 收尾移除 `edit` 區塊中已不可達的重複「開啟地圖」連結(`v-if="!canEdit && form.mapUrl"`,進入 edit 即 `canEdit`,永遠不會渲染)。

## 結果與驗證

以 subagent-driven 流程逐 task 實作 + 每 task review,最終 opus 全分支 review 判定 **ready to merge**,無 Critical/Important。

- **typecheck / lint**:全程只剩既有且無關的 `app/pages/equipment.vue(342,22)` baseline 錯誤,無新增;lint 觸及檔案乾淨。
- **headless Chrome 端到端實測**(dev server、系統 Chrome):
  - 有 `gathering` 權(超管):點列→「活動明細」;view 顯示時間/地點/流程/料理、隱藏參加名單/操鍋/收支;點料理→食材/作法展開;按「編輯」→「編輯活動」完整表單(參加名單、收支折疊區 人數/收費、儲存鈕)。
  - 匿名(無 `gathering` 權):點列→僅 view、無「編輯」鈕、無「新增活動」鈕、view 無收支。
  - 新增:按「新增活動」→ 直接進「新增活動」編輯表單。
  - 後端:匿名 `GET /api/gathering-finances`→401(已改需 `gathering`);公開 `GET /api/gatherings`→200。
- 已合併回 `main`(fast-forward),分支 `feat/gathering-view-first` 已刪除。

## 後續事項

- **部署後由超管補權限**:原本只被授予 `gathering-finance` 的使用者,需在 `/admin` 重新勾選 `gathering` 才能再操作家聚點收支。
- 清理提醒:`docs/superpowers/plans/` 尚有兩個更早任務的過程檔(`2026-07-09-seasonal-time-theme.md`、`2026-07-11-gathering-records-calendar.md`),非本次任務建立,未一併處理,待確認後可另行清除。
