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
  // 導覽列圖示（Nuxt UI icon 名稱）
  icon: string
  // 是否在導覽列顯示（預設 true）。用於「多個權限 key 共用同一路由」的情形：
  // 例如家聚點一頁三分頁，只有主 key 顯示在導覽列，其餘分頁 key 設 false。
  nav?: boolean
}

export const PAGES: PageDef[] = [
  { key: 'calendar', label: '課表', path: '/', access: 'public', icon: 'i-lucide-calendar-days' },
  { key: 'equipment', label: '器材室管理', path: '/equipment', access: 'public', icon: 'i-lucide-package' },
  { key: 'crm', label: '名單', path: '/crm', access: 'private', icon: 'i-lucide-contact' },
  // 家聚點（spec 0021）：一頁 /gathering、三分頁、各自授權。
  // gathering 需排在最前：pageByPath('/gathering') 取第一筆（public）→ 路由人人可進。
  { key: 'gathering', label: '家聚點', path: '/gathering', access: 'public', icon: 'i-lucide-home' },
  { key: 'gathering-finance', label: '家聚點·收支', path: '/gathering', access: 'private', icon: 'i-lucide-home', nav: false },
  { key: 'gathering-recipe', label: '家聚點·食譜', path: '/gathering', access: 'private', icon: 'i-lucide-home', nav: false }
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
