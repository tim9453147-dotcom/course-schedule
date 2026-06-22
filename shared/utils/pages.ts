// 頁面登記表：前後端共用的單一來源（Nuxt shared/ 自動匯入）。
// 之後要新增功能頁（例如 CRM）只要在 PAGES 加一筆，
// 導覽列、路由 middleware、管理者勾選介面、後端 requirePage 都會自動跟著生效。

export type PageAccess = 'public' | 'private'

export interface PageDef {
  // 權限 key，存進 users.pages 的就是這個
  key: string
  // 顯示名稱（導覽列、管理者勾選用）
  label: string
  // 路由路徑
  path: string
  // public：人人可看，權限決定能否「編輯」
  // private：未登入/無權限者看不到，權限決定能否「看見並使用」
  access: PageAccess
}

export const PAGES: PageDef[] = [
  { key: 'calendar', label: '課表', path: '/', access: 'public' },
  { key: 'equipment', label: '器材室管理', path: '/equipment', access: 'public' }
  // { key: 'crm', label: 'CRM', path: '/crm', access: 'private' } // 日後新增
]

export const PAGE_KEYS = PAGES.map(p => p.key)

export function pageByKey(key: string): PageDef | undefined {
  return PAGES.find(p => p.key === key)
}

export function pageByPath(path: string): PageDef | undefined {
  return PAGES.find(p => p.path === path)
}

// 過濾出合法的權限 key（擋掉不存在的頁面 key）
export function sanitizePages(keys: unknown): string[] {
  if (!Array.isArray(keys)) return []
  return PAGE_KEYS.filter(k => keys.includes(k))
}
