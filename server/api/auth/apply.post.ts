import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '../../db/schema'

const applySchema = z.object({
  username: z.string().trim().min(1, '請輸入帳號'),
  displayName: z.string().trim().min(1, '請輸入顯示名稱'),
  password: z.string().min(6, '密碼至少 6 碼'),
  note: z.string().trim().max(500).nullish()
})

// 申請帳號（公開）：建立一筆 status='pending' 的 user，等管理者審核。
export default defineEventHandler(async (event) => {
  const data = await readValidatedBody(event, applySchema.parse)
  const db = useDb(event)

  // 帳號需唯一
  const exists = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, data.username))
    .get()
  if (exists) {
    throw createError({ statusCode: 409, statusMessage: '此帳號已被使用' })
  }

  const passwordHash = await hashPassword(data.password)
  await db.insert(users).values({
    username: data.username,
    displayName: data.displayName,
    passwordHash,
    status: 'pending',
    pages: '[]',
    note: data.note ?? null
  })

  setResponseStatus(event, 201)
  return { ok: true }
})
