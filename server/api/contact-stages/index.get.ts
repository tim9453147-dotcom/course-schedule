import { asc } from 'drizzle-orm'
import { contactStages } from '../../db/schema'

// 種子用的預設階段（首次為空時建立）
const DEFAULT_STAGE_LABELS = ['2', '336', '加入', '28']

// 取得本人的進度階段（需 crm 權限）：依排序回傳；首次為空時種子預設階段。
export default defineEventHandler(async (event) => {
  const actor = await requirePage(event, 'crm')
  const db = useDb(event)
  const owner = ownerKey(actor)

  const list = () =>
    db
      .select()
      .from(contactStages)
      .where(ownedBy(contactStages.userId, owner))
      .orderBy(asc(contactStages.sortOrder), asc(contactStages.id))

  const existing = await list()
  if (existing.length) return existing

  // 尚無階段 → 種子預設「2／336／加入／28」（單次 insert，多列一起寫入）
  const now = Math.floor(Date.now() / 1000)
  await db.insert(contactStages).values(
    DEFAULT_STAGE_LABELS.map((label, i) => ({
      userId: owner,
      label,
      sortOrder: i,
      createdAt: now
    }))
  )

  return await list()
})
