import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '../../db/schema'

const updateSchema = z.object({
  displayName: z.string().trim().min(1).optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'disabled']).optional(),
  pages: z.array(z.string()).optional(),
  classrooms: z.array(z.string()).optional(),
  // 重設密碼（選填）
  password: z.string().min(6).optional()
})

// 更新使用者：審核（status）、授權頁面（pages）、改名、重設密碼。超級管理員專用。
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '使用者 id 不正確' })
  }

  const body = await readValidatedBody(event, updateSchema.parse)
  const db = useDb(event)

  const patch: Record<string, unknown> = {}
  if (body.displayName !== undefined) patch.displayName = body.displayName
  if (body.pages !== undefined) patch.pages = JSON.stringify(sanitizePages(body.pages))
  if (body.classrooms !== undefined) patch.classrooms = JSON.stringify(sanitizeClassrooms(body.classrooms))
  if (body.password !== undefined) patch.passwordHash = await hashPassword(body.password)
  if (body.status !== undefined) {
    patch.status = body.status
    // 通過審核時記錄時間
    if (body.status === 'approved') patch.approvedAt = Math.floor(Date.now() / 1000)
  }

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: '沒有要更新的欄位' })
  }

  const [updated] = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      status: users.status,
      pages: users.pages,
      note: users.note,
      createdAt: users.createdAt,
      approvedAt: users.approvedAt
    })

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: '找不到這個使用者' })
  }

  return { ...updated, pages: parsePages(updated.pages) }
})
