import { createRemoteJWKSet, jwtVerify } from 'jose'
import { eq, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { users } from '../db/schema'
import type { User } from '../db/schema'

const ACCESS_PASSWORD_SENTINEL = '!cloudflare-access!'
const remoteJwks = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

export interface CloudflareAccessIdentity {
  email: string
  subject: string
  issuer: string
}

export type AccessPrincipal
  = | { kind: 'super-admin', identity: CloudflareAccessIdentity }
    | { kind: 'user', identity: CloudflareAccessIdentity, user: User }

function normalizeTeamDomain(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

function superAdminEmails(event: H3Event): string[] {
  const config = useRuntimeConfig(event)
  return config.cloudflareAccessSuperAdminEmails
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean)
}

function getJwks(teamDomain: string) {
  let jwks = remoteJwks.get(teamDomain)
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`))
    remoteJwks.set(teamDomain, jwks)
  }
  return jwks
}

// 驗證 Access 注入的 JWT，而不是直接相信可被偽造的 email header。
// 本機開發沒有 Access edge，可用 NUXT_CLOUDFLARE_ACCESS_DEV_EMAIL 模擬身分；
// import.meta.dev 確保這條路徑不會被帶進 production。
export async function getCloudflareAccessIdentity(event: H3Event): Promise<CloudflareAccessIdentity | null> {
  if (event.context.cloudflareAccessIdentityResolved) {
    return event.context.cloudflareAccessIdentity ?? null
  }
  event.context.cloudflareAccessIdentityResolved = true

  const config = useRuntimeConfig(event)
  const token = getRequestHeader(event, 'cf-access-jwt-assertion')

  if (!token && import.meta.dev && config.cloudflareAccessDevEmail.trim()) {
    const email = config.cloudflareAccessDevEmail.trim().toLowerCase()
    const identity = { email, subject: `dev:${email}`, issuer: 'local-development' }
    event.context.cloudflareAccessIdentity = identity
    return identity
  }

  if (!token) return null

  const teamDomain = normalizeTeamDomain(config.cloudflareAccessTeamDomain)
  const audience = config.cloudflareAccessAudience.trim()
  if (!teamDomain || !audience) {
    throw createError({ statusCode: 500, statusMessage: 'Cloudflare Access 尚未完成設定' })
  }

  try {
    const { payload } = await jwtVerify(token, getJwks(teamDomain), {
      issuer: teamDomain,
      audience,
      algorithms: ['RS256']
    })
    if (typeof payload.email !== 'string' || !payload.email.trim()) {
      throw new Error('JWT 缺少 email claim')
    }

    const identity = {
      email: payload.email.trim().toLowerCase(),
      subject: payload.sub ?? '',
      issuer: payload.iss ?? teamDomain
    }
    event.context.cloudflareAccessIdentity = identity
    return identity
  } catch (error) {
    console.error('Cloudflare Access JWT 驗證失敗', error)
    throw createError({ statusCode: 401, statusMessage: 'Cloudflare Access 身分驗證失敗' })
  }
}

export function isCloudflareSuperAdmin(event: H3Event, email: string): boolean {
  return superAdminEmails(event).includes(email.toLowerCase())
}

async function findUserByEmail(event: H3Event, email: string): Promise<User | undefined> {
  const db = useDb(event)
  const mapped = await db.select().from(users).where(eq(users.accessEmail, email)).get()
  if (mapped) return mapped

  // 第一次上線時，沿用原本以 email 當 username 的帳號及其所有資料/權限。
  const legacy = await db.select().from(users).where(sql`lower(${users.username}) = ${email}`).get()
  if (!legacy) return undefined
  try {
    await db.update(users).set({ accessEmail: email }).where(eq(users.id, legacy.id))
    return { ...legacy, accessEmail: email }
  } catch {
    return db.select().from(users).where(eq(users.accessEmail, email)).get()
  }
}

// Access 完成「驗證身分」，D1 user 保留「審核狀態與應用程式權限」。
// 第一次看到的新 email 會自動成為 pending，讓超管從既有後台核准。
async function findOrCreateAccessUser(event: H3Event, email: string): Promise<User> {
  const existing = await findUserByEmail(event, email)
  if (existing) return existing

  const db = useDb(event)
  try {
    const [created] = await db
      .insert(users)
      .values({
        username: email,
        accessEmail: email,
        displayName: email.split('@')[0] || email,
        // 欄位為舊帳密系統相容性而保留；Access 模式不會讀取或驗證此值。
        passwordHash: ACCESS_PASSWORD_SENTINEL,
        status: 'pending',
        pages: '[]',
        classrooms: '["中壢"]',
        note: '由 Cloudflare Access 首次登入自動建立'
      })
      .returning()
    if (created) return created
  } catch {
    // 同一位使用者的平行首批請求可能同時 insert；唯一鍵勝出的那筆即為準。
  }

  const raced = await findUserByEmail(event, email)
  if (!raced) {
    throw createError({ statusCode: 500, statusMessage: '無法建立 Access 使用者' })
  }
  return raced
}

export async function getAccessPrincipal(event: H3Event): Promise<AccessPrincipal | null> {
  if (event.context.accessPrincipalResolved) {
    return event.context.accessPrincipal ?? null
  }
  event.context.accessPrincipalResolved = true

  const identity = await getCloudflareAccessIdentity(event)
  if (!identity) return null

  const principal: AccessPrincipal = isCloudflareSuperAdmin(event, identity.email)
    ? { kind: 'super-admin', identity }
    : { kind: 'user', identity, user: await findOrCreateAccessUser(event, identity.email) }

  event.context.accessPrincipal = principal
  return principal
}

export async function syncAccessSession(event: H3Event): Promise<AccessPrincipal | null> {
  const principal = await getAccessPrincipal(event)
  if (!principal) return null

  const current = await getUserSession(event)
  const isSuperAdmin = principal.kind === 'super-admin'
  const user = principal.kind === 'user' ? principal.user : null
  const accountStatus = isSuperAdmin ? 'approved' : user!.status
  const pages = isSuperAdmin ? PAGE_KEYS : accountStatus === 'approved' ? parsePages(user!.pages) : []
  const classrooms = isSuperAdmin ? CLASSROOMS : accountStatus === 'approved' ? parseClassrooms(user!.classrooms) : []
  const name = isSuperAdmin ? principal.identity.email : user!.displayName
  const userId = user?.id

  const unchanged
    = current.accessEmail === principal.identity.email
      && current.userId === userId
      && current.isSuperAdmin === isSuperAdmin
      && current.accountStatus === accountStatus
      && current.user?.name === name
      && JSON.stringify(current.pages ?? []) === JSON.stringify(pages)
      && JSON.stringify(current.classrooms ?? []) === JSON.stringify(classrooms)

  if (!unchanged) {
    await replaceUserSession(event, {
      user: { name, email: principal.identity.email },
      userId,
      accessEmail: principal.identity.email,
      accountStatus,
      isSuperAdmin,
      pages,
      classrooms,
      loggedInAt: current.loggedInAt ?? Date.now()
    })
  }
  return principal
}
