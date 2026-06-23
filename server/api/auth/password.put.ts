import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '../../db/schema'

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6)
})

// 使用者修改自己的密碼（需登入）。
// 超級管理員密碼由環境變數設定，不在此處理。
export default defineEventHandler(async (event) => {
  const actor = await getActor(event)
  if (!actor) {
    throw createError({ statusCode: 401, statusMessage: '請先登入（或帳號已停用）' })
  }
  if (actor.isSuperAdmin) {
    throw createError({ statusCode: 400, statusMessage: '超級管理員密碼由系統設定，無法在此修改' })
  }

  const { currentPassword, newPassword } = await readValidatedBody(event, schema.parse)

  const ok = await verifyPassword(actor.user.passwordHash, currentPassword)
  if (!ok) {
    throw createError({ statusCode: 400, statusMessage: '目前密碼不正確' })
  }

  const db = useDb(event)
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword) })
    .where(eq(users.id, actor.user.id))

  return { ok: true }
})
