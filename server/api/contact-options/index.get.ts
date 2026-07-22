import { asc } from 'drizzle-orm'
import { contactOptions, contacts } from '../../db/schema'

// 取得本人的「誰的朋友／開發夥伴」共用選項（需 crm 權限）。
// 首次為空時，自動收錄現有名單裡填過的 friendOf/devPartner 值當起始選項。
export default defineEventHandler(async (event) => {
  const actor = await requirePage(event, 'crm')
  const db = useDb(event)
  const owner = ownerKey(actor)

  const list = () =>
    db
      .select()
      .from(contactOptions)
      .where(ownedBy(contactOptions.userId, owner))
      .orderBy(asc(contactOptions.label))

  const existing = await list()
  if (existing.length) return existing

  // 尚無選項 → 從現有名單的 friendOf/devPartner 收錄（非空、去空白、去重）
  const rows = await db
    .select({ friendOf: contacts.friendOf, devPartner: contacts.devPartner })
    .from(contacts)
    .where(ownedBy(contacts.userId, owner))
  const seen = new Set<string>()
  for (const r of rows) {
    for (const v of [r.friendOf, r.devPartner]) {
      const label = (v ?? '').trim()
      if (label) seen.add(label)
    }
  }
  if (seen.size) {
    const now = Math.floor(Date.now() / 1000)
    await db.insert(contactOptions).values(
      [...seen].map(label => ({ userId: owner, label, createdAt: now }))
    )
  }
  return await list()
})
