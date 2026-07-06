import { and, eq } from 'drizzle-orm'
import { prospects } from '../../db/schema'

// 刪除每日任務名單一列（需 crm 權限）：僅限自己的資料
export default defineEventHandler(async (event) => {
  const actor = await requirePage(event, 'crm')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '資料 id 不正確' })
  }

  const db = useDb(event)

  const owner = ownedBy(prospects.userId, ownerKey(actor))
  const [current] = await db.select().from(prospects).where(and(eq(prospects.id, id), owner))
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: '找不到這筆資料' })
  }

  await db.delete(prospects).where(and(eq(prospects.id, id), owner))

  return { ok: true }
})
