// 管理員登出：清除 session
export default defineEventHandler(async (event) => {
  await clearUserSession(event)
  return { ok: true }
})
