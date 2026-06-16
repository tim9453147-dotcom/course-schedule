// 器材資料型別（對應後端 equipment 表）
export interface Equipment {
  id: number
  classroom: string
  name: string
  category: string | null
  totalQty: number
  note: string | null
  createdAt: number
}

// 借還紀錄型別（/api/rentals 會帶上器材名稱與教室）
export interface Rental {
  id: number
  equipmentId: number
  equipmentName: string | null
  classroom: string | null
  borrower: string
  qty: number
  borrowDate: string
  dueDate: string | null
  returnDate: string | null
  note: string | null
}

// 取得今天的 'YYYY-MM-DD'
export function todayStr() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
