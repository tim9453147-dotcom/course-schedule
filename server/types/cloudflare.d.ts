// 讓 TypeScript 知道 event.context.cloudflare.env 上有哪些 Cloudflare 綁定。
// D1Database 由 cloudflare-pages preset 自動帶入的全域型別提供。
declare module 'h3' {
  interface H3EventContext {
    cloudflare?: {
      env: {
        DB: D1Database
      }
    }
  }
}

export {}
