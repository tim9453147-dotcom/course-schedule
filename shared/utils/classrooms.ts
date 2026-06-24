// 教室清單：前後端共用的單一來源（Nuxt shared/ 自動匯入）。
// 課表分頁、使用者「可看課表」設定、後端驗證都從這裡取得。

export const CLASSROOMS = ['中壢', '新竹', '台北', '台中']

// 新使用者／未登入者預設只看得到中壢
export const DEFAULT_CLASSROOMS = ['中壢']

// 過濾出合法的教室名稱（擋掉不存在的值）
export function sanitizeClassrooms(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return CLASSROOMS.filter(c => values.includes(c))
}
