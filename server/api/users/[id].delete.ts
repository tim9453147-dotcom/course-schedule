import { eq } from 'drizzle-orm'
import { users } from '../../db/schema'

// 刪除使用者。超級管理員專用。
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '使用者 id 不正確' })
  }

  const db = useDb(event)
  const [deleted] = await db
    .delete(users)
    .where(eq(users.id, id))
    .returning({ id: users.id })

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: '找不到這個使用者' })
  }

  return { ok: true }
})
