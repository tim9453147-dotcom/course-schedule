// 每日任務型別（對應後端 prospects 表 + 帶出的 contact 明細）
// 四個區塊：develop=開發名單 / reserve=預備名單 / five=五人名單 / network=織網表
// 每一列＝把某位總名單對象放進某個區塊；姓名與延伸欄位皆來自 contact，這裡只有 date 屬於這一列。
export type ProspectSection = 'develop' | 'reserve' | 'five' | 'network'

export interface Prospect {
  id: number
  section: ProspectSection
  date: string | null
  contactId: number
  createdAt: number
  // 所引用的總名單對象（後端 join 帶出）
  contact: Contact
}

// 開發名單等級選項（固定下拉，存於 contact.level）
export const PROSPECT_LEVEL_OPTIONS = ['SSR', 'SR', 'R']

// 各區塊的顯示標題（每日任務頁面用）
export const PROSPECT_SECTION_META: Record<ProspectSection, { title: string }> = {
  develop: { title: '開發名單' },
  reserve: { title: '預備名單' },
  five: { title: '五人名單' },
  network: { title: '織網表' }
}

// 等級徽章顏色
export function levelColor(level: string | null | undefined): 'error' | 'warning' | 'neutral' {
  if (level === 'SSR') return 'error'
  if (level === 'SR') return 'warning'
  return 'neutral'
}
