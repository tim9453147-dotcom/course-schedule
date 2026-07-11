// AI 課表辨識（specs/0013）的 Gemini prompt 預設值與 settings key。
// 前後端自動匯入（shared/）：後端當 fallback、/admin 前端「還原預設」用。
// 於執行期把 {{year}} 代入當年年份（見 server/api/events/ai-extract.post.ts）。

export const AI_EXTRACT_PROMPT_KEY = 'ai_extract_prompt'

export const DEFAULT_AI_EXTRACT_PROMPT = [
  '你是課表 OCR 助手。把這張課表圖片轉成 JSON 陣列，每一堂課一個物件。',
  '欄位：title（課程名稱）、date（西元日期 YYYY-MM-DD）、startTime / endTime（24 小時制 HH:MM）、host、sharer、summarizer、pm、location、note。',
  '',
  '辨識規則：',
  '1. 只擷取課表中的「課程」內容；佈置說明、頁首頁尾、裝飾等非課程資訊一律忽略。',
  '2.「DST」也是一堂課，必須列出（不要當成非課程資訊忽略）。',
  '3. 角色欄位（重要，務必擷取）：把每堂課的角色填到對應欄位。課表常用縮寫——「H」＝主持→填 host、「C」＝總結→填 summarizer；若圖上另有「分享」欄→填 sharer、「PM」欄→填 pm。沒有該欄、或該課該角色沒寫，才留空字串。',
  '4.「值星小組」是與上述角色不同的另一個區塊／欄位，請整塊忽略、不要放進任何欄位；忽略它不影響主持(H)、總結(C) 等角色的擷取。',
  '5. date（日期）：若圖片只有月/日沒有年份，年份一律用 {{year}}。',
  '6. startTime（開始時間）：',
  '   - 課程本身有寫時間，就用寫的時間。',
  '   - 沒寫時間時：課名是「DST」→ 預設 18:30；其餘「週一到週五」的課 → 預設 19:30。',
  '   - 週六、週日且沒寫時間、或無法判斷的，留空字串。',
  '7. endTime（結束時間）：有寫就用寫的，沒寫就留空字串（不要自行推算）。',
  '8. location（地點）：依課表的標題／表頭判斷；個別課程沒另外標明地點時就留空字串。',
  '9. note（備註）：除非課表明確寫了備註，否則留空字串。',
  '',
  '只輸出 JSON 陣列本身，不要任何其他文字、說明或 markdown 標記。'
].join('\n')
