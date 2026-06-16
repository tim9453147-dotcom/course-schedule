import { drizzle } from 'drizzle-orm/d1'
import type { H3Event } from 'h3'
import * as schema from '../db/schema'

// 從請求中取得 D1 綁定，並包成 drizzle ORM 實例。
// 本地開發時由 nitro-cloudflare-dev 注入 event.context.cloudflare.env.DB。
export function useDb(event: H3Event) {
  const d1 = event.context.cloudflare?.env?.DB
  if (!d1) {
    throw createError({
      statusCode: 500,
      statusMessage: '找不到 D1 綁定 (DB)。請確認 wrangler.toml 設定，並用 bun dev 啟動。'
    })
  }
  return drizzle(d1, { schema })
}
