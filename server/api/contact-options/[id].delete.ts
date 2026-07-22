import { and, eq } from 'drizzle-orm'
import { contactOptions } from '../../db/schema'

// 刪除共用人名選項（需 crm 權限）：僅限本人；不動任何名單已存的 friendOf/devPartner 值。
export default defineEventHandler(async (event) => {
  const actor = await requirePage(event, 'crm')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '選項 id 不正確' })
  }

  const db = useDb(event)
  const owner = ownedBy(contactOptions.userId, ownerKey(actor))

  const [deleted] = await db
    .delete(contactOptions)
    .where(and(eq(contactOptions.id, id), owner))
    .returning()
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: '找不到這個選項' })
  }
  return { ok: true }
})
