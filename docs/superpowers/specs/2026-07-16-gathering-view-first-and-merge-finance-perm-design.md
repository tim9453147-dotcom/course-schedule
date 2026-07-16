# 家聚點:檢視優先 + 收支權限併入活動權限

日期:2026-07-16

## 背景與目標

家聚點「活動紀錄」目前點清單列即直接開啟完整編輯表單(無權者欄位 `disabled` 當唯讀用)。
兩個需求:

1. **檢視優先**:點清單列先看到一個精簡的資訊檢視,按「編輯」才進入編輯表單。
2. **權限合併**:把「編輯活動」(`gathering`)與「編輯收支」(`gathering-finance`)兩個獨立權限合併成單一 `gathering` 權限。

## 需求細節

### 精簡 info 檢視

點清單列 → Modal 開在 `view` 模式,只顯示以下欄位(**無值的欄位不顯示**):

- **時間**:日期 + 起訖時間(`date` / `startTime`–`endTime`)
- **地點**:`location`;若有 `mapUrl`,附「開啟地圖」連結
- **流程**:`process`(保留換行)
- **料理**:引用食譜的名稱(`recipeId` → 食譜);**點一下料理才展開**該食譜的食材(`ingredients`)與作法(`steps`)

精簡 info **不顯示**操鍋/助手/採買、參加名單、備註、收支盈餘。

- 有 `gathering` 權者:info 檢視右下顯示「**編輯**」按鈕 → 切到 `edit` 模式(現有完整表單,含收支區塊)。
- 無 `gathering` 權的純檢視者:只看得到精簡 info,不顯示「編輯」按鈕。
- 「新增活動」仍直接開 `edit` 模式的空白表單。

### 權限合併

移除 `gathering-finance` 獨立權限,收支的讀取/編輯改由 `gathering` 權控管。

## 實作範圍

### 後端

- `server/api/gathering-finances/index.get.ts`:`requirePage(event, 'gathering-finance')` → `'gathering'`。
- `server/api/gathering-finances/[gatheringId].put.ts`:同上改成 `'gathering'`。
- 更新兩檔開頭的中文註解(不再提「gathering-finance 權」)。

### 權限登記表

- `shared/utils/pages.ts`:刪除 `gathering-finance` 那筆 `PAGES` 項目。
  - `gathering-recipe` 保留不動。
  - `sanitizePages` 會自動濾掉已不存在的 key,無需改動函式本身。

### 前端 `app/components/GatheringRecords.vue`

- 移除 `canFinance`,全部改用單一 `canEdit = useCanEdit('gathering')`。
  - 收支列表抓取 `immediate` 改看 `canEdit`。
  - 清單盈餘徽章的顯示條件 `canFinance && row.fin` → `canEdit && row.fin`(**盈餘徽章保留**)。
  - `save()` 內原本「finance-only 使用者只存收支、不打 /api/gatherings」的分支消失;有 `canEdit` 時一併存活動與收支,邏輯簡化。
- 新增 modal 模式狀態 `mode: 'view' | 'edit'`。
  - `openRow(g)`:載入資料後設 `mode = 'view'`(有 `gathering` 權時可按「編輯」切到 `edit`;無權者維持 `view`)。
  - `openCreate()`:設 `mode = 'edit'`。
  - Modal 標題依模式:`view` → 「活動明細」;`edit` 新增 → 「新增活動」、編輯既有 → 「編輯活動」。
- `view` 模式的精簡 info 版面:時間 / 地點(+開啟地圖)/ 流程 / 料理(點擊展開食材與作法,沿用現有 `showRecipe` 切換與 `selectedRecipe`)。
- `edit` 模式沿用現有完整表單、儲存與刪除邏輯,基本不動(僅欄位不再需要 `:disabled="!canEdit"` 的唯讀情境,因為無權者不會進到 `edit`;可保留 disabled 綁定作為保險,不強制移除)。
- 「編輯」按鈕只在 `mode==='view' && canEdit` 時顯示。

## 既有資料處理

目前若有使用者只被授予 `gathering-finance` 而無 `gathering`,合併後該 key 失效(`sanitizePages` 濾除),會失去家聚點收支存取。

- **不寫自動 migration**:D1 local / remote 分離、使用者數少。
- 由超管在 `/admin` 重新勾選 `gathering` 補回即可。

## 不做(YAGNI)

- 不動 `gathering-recipe`(食譜列表)權限。
- 不改資料表結構(`gathering_finances` 維持)。
- 精簡 info 不加任何收支顯示。

## 驗證方式

以 `bun dev` + headless Chrome 驗證三種身分:

1. 無 `gathering` 權:點列只見精簡 info、無「編輯」;看不到收支。
2. 有 `gathering` 權:點列見精簡 info → 按「編輯」進表單,可編活動與收支;清單盈餘徽章正常。
3. 「新增活動」直接進空白編輯表單並可存檔。

料理點擊展開食材/作法正常;`typecheck` / `lint` 通過。
