import { and, eq } from 'drizzle-orm'
import { contactStages } from '../../db/schema'

// 刪除進度階段（需 crm 權限）：僅限自己的階段。
// 註：各名單 completedStages 內可能殘留已刪階段的孤兒 id，前端只渲染現存階段、忽略未知 id，不做級聯清理。
export default defineEventHandler(async (event) => {
  const actor = await requirePage(event, 'crm')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '階段 id 不正確' })
  }

  const db = useDb(event)
  const owner = ownedBy(contactStages.userId, ownerKey(actor))

  const [deleted] = await db
    .delete(contactStages)
    .where(and(eq(contactStages.id, id), owner))
    .returning()
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: '找不到這個階段' })
  }
  return { ok: true }
})
