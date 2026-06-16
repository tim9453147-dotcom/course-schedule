import { z } from 'zod'

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
})

// 管理員登入：比對環境變數中的帳密，成功就建立 session
export default defineEventHandler(async (event) => {
  const { username, password } = await readValidatedBody(event, loginSchema.parse)
  const config = useRuntimeConfig(event)

  const ok
    = username === config.adminUsername
      && password === config.adminPassword
      && config.adminPassword !== ''

  if (!ok) {
    throw createError({ statusCode: 401, statusMessage: '帳號或密碼錯誤' })
  }

  await setUserSession(event, {
    user: { name: username },
    loggedInAt: Date.now()
  })

  return { ok: true }
})
