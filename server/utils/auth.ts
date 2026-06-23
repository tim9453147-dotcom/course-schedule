import { eq, isNull } from 'drizzle-orm'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'
import type { H3Event } from 'h3'
import { users } from '../db/schema'
import type { User } from '../db/schema'

// 擴充 nuxt-auth-utils 的 session 型別
declare module '#auth-utils' {
  interface User {
    name: string
  }
  interface UserSession {
    // DB 使用者 id；超級管理員為 undefined
    userId?: number
    isSuperAdmin?: boolean
    // 給前端導覽列用；後端強制權限時不信任這個，會重查 DB
    pages?: string[]
    loggedInAt?: number
  }
}

// 安全解析 users.pages（JSON 字串陣列），擋掉壞資料與不存在的頁面 key
export function parsePages(raw: string | null | undefined): string[] {
  try {
    return sanitizePages(JSON.parse(raw || '[]'))
  } catch {
    return []
  }
}

export type Actor
  = | { isSuperAdmin: true, pages: string[] }
    | { isSuperAdmin: false, user: User, pages: string[] }

// 取得目前登入者的「即時」狀態（每次查 DB，所以停用/改權限會立即生效）。
// 未登入、或帳號非 approved，皆回 null。
export async function getActor(event: H3Event): Promise<Actor | null> {
  const session = await getUserSession(event)
  if (session.isSuperAdmin) {
    return { isSuperAdmin: true, pages: PAGE_KEYS }
  }
  const userId = session.userId
  if (!userId) return null

  const db = useDb(event)
  const u = await db.select().from(users).where(eq(users.id, userId)).get()
  if (!u || u.status !== 'approved') return null

  return { isSuperAdmin: false, user: u, pages: parsePages(u.pages) }
}

// 要求對某個頁面有權限（public 頁＝可編輯、private 頁＝可看見/使用）。
// 回傳 actor 方便後續使用。
export async function requirePage(event: H3Event, key: string): Promise<Actor> {
  const actor = await getActor(event)
  if (!actor) {
    throw createError({ statusCode: 401, statusMessage: '請先登入（或帳號已停用）' })
  }
  if (!actor.isSuperAdmin && !actor.pages.includes(key)) {
    throw createError({ statusCode: 403, statusMessage: '沒有使用此功能的權限' })
  }
  return actor
}

// 個人資料（名單等）的擁有者鍵：一般使用者為其 id，超級管理員為 null。
export function ownerKey(actor: Actor): number | null {
  return actor.isSuperAdmin ? null : actor.user.id
}

// 依擁有者鍵組出 WHERE 條件（null 須用 IS NULL，不能用 = NULL）。
export function ownedBy(column: SQLiteColumn, key: number | null) {
  return key === null ? isNull(column) : eq(column, key)
}

// 要求超級管理員（管理者頁、使用者管理 API）
export async function requireSuperAdmin(event: H3Event): Promise<void> {
  const session = await getUserSession(event)
  if (!session.isSuperAdmin) {
    throw createError({ statusCode: 403, statusMessage: '需要超級管理員權限' })
  }
}
