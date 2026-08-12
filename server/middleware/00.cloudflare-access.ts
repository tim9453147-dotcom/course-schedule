const MACHINE_ENDPOINTS = new Set([
  '/api/line/webhook',
  '/api/notifications/daily-digest'
])

// 在 SSR 與 session API 執行前，把已驗證的 Cloudflare Access 身分投影到前端 session。
// 真正的 API 授權仍由 requirePage / requireSuperAdmin 每次依 Access JWT + D1 判斷。
export default defineEventHandler(async (event) => {
  const principal = await syncAccessSession(event)
  if (!principal && !import.meta.dev && !MACHINE_ENDPOINTS.has(getRequestURL(event).pathname)) {
    throw createError({ statusCode: 401, statusMessage: '需要 Cloudflare Access 身分驗證' })
  }
})
