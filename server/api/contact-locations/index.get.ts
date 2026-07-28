import { asc } from 'drizzle-orm'
import { contactLocations, contacts } from '../../db/schema'

// 取得本人的「地點」選項（需 crm 權限）。
// 首次為空時，預設只有「中壢」（若現有名單已填其他地點，也會一併收錄）。
export default defineEventHandler(async (event) => {
  const actor = await requirePage(event, 'crm')
  const db = useDb(event)
  const owner = ownerKey(actor)

  const list = () =>
    db
      .select()
      .from(contactLocations)
      .where(ownedBy(contactLocations.userId, owner))
      .orderBy(asc(contactLocations.label))

  const existing = await list()
  if (existing.length) return existing

  // 尚無選項 → 預設「中壢」＋從現有名單 location 收錄
  const rows = await db
    .select({ location: contacts.location })
    .from(contacts)
    .where(ownedBy(contacts.userId, owner))

  const seen = new Set<string>()
  seen.add('中壢') // 預設只有中壢

  for (const r of rows) {
    const label = (r.location ?? '').trim()
    if (label) seen.add(label)
  }

  const now = Math.floor(Date.now() / 1000)
  await db.insert(contactLocations).values(
    [...seen].map(label => ({ userId: owner, label, createdAt: now }))
  )

  return await list()
})
