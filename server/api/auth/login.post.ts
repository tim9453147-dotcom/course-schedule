import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '../../db/schema'

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
})

// 登入：先比對超級管理員（環境變數），否則查 users 表。
export default defineEventHandler(async (event) => {
  const { username, password } = await readValidatedBody(event, loginSchema.parse)
  const config = useRuntimeConfig(event)

  // 1) 超級管理員：環境變數帳密（不進 DB、永遠全權限）
  const isSuper
    = username === config.adminUsername
      && password === config.adminPassword
      && config.adminPassword !== ''
  if (isSuper) {
    await setUserSession(event, {
      user: { name: username },
      isSuperAdmin: true,
      pages: PAGE_KEYS,
      loggedInAt: Date.now()
    })
    return { ok: true }
  }

  // 2) 一般使用者：查 DB
  const db = useDb(event)
  const u = await db.select().from(users).where(eq(users.username, username)).get()

  // 先驗證密碼，再看狀態 —— 避免未持有正確密碼者藉錯誤訊息探測帳號狀態
  const passwordOk = u ? await verifyPassword(u.passwordHash, password) : false
  if (!u || !passwordOk) {
    throw createError({ statusCode: 401, statusMessage: '帳號或密碼錯誤' })
  }

  if (u.status === 'pending') {
    throw createError({ statusCode: 403, statusMessage: '帳號審核中，請等待管理者通過' })
  }
  if (u.status === 'rejected') {
    throw createError({ statusCode: 403, statusMessage: '帳號申請未通過' })
  }
  if (u.status === 'disabled') {
    throw createError({ statusCode: 403, statusMessage: '帳號已停用' })
  }

  await setUserSession(event, {
    user: { name: u.displayName },
    userId: u.id,
    isSuperAdmin: false,
    pages: parsePages(u.pages),
    loggedInAt: Date.now()
  })
  return { ok: true }
})
