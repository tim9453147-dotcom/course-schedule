// 色系主題清單：前後端共用的單一來源（Nuxt shared/ 自動匯入）。
// header 下拉、後端 PUT 驗證、載入套用都從這裡取得。
// 每個主題 = 一組 Nuxt UI 設定：primary / neutral 調色盤 + 深/淺色模式。

export const THEMES = [
  // 深色系
  { id: 'black', label: '石墨黑', primary: 'zinc', neutral: 'neutral', mode: 'dark' },
  { id: 'cyber', label: '科技感', primary: 'cyan', neutral: 'slate', mode: 'dark' },
  { id: 'ocean', label: '海洋藍', primary: 'blue', neutral: 'slate', mode: 'dark' },
  { id: 'indigo', label: '靛藍', primary: 'indigo', neutral: 'slate', mode: 'dark' },
  { id: 'forest', label: '森林綠', primary: 'emerald', neutral: 'zinc', mode: 'dark' },
  { id: 'violet', label: '霓虹紫', primary: 'violet', neutral: 'zinc', mode: 'dark' },
  { id: 'fuchsia', label: '桃紅', primary: 'fuchsia', neutral: 'zinc', mode: 'dark' },
  { id: 'rose', label: '玫瑰紅', primary: 'rose', neutral: 'stone', mode: 'dark' },
  { id: 'sunset', label: '日落橘', primary: 'orange', neutral: 'stone', mode: 'dark' },
  // 淺色系
  { id: 'light', label: '明亮', primary: 'zinc', neutral: 'neutral', mode: 'light' },
  { id: 'cute', label: '可愛風', primary: 'pink', neutral: 'stone', mode: 'light' },
  { id: 'beach', label: '沙灘風', primary: 'amber', neutral: 'stone', mode: 'light' },
  { id: 'mint', label: '薄荷綠', primary: 'teal', neutral: 'gray', mode: 'light' }
] as const

export type ThemeId = (typeof THEMES)[number]['id']

// 全站預設主題（尚未由管理員設定時採用）
export const DEFAULT_THEME: ThemeId = 'black'

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && THEMES.some(t => t.id === v)
}
