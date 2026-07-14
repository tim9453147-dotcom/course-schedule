import { eq, isNull, inArray } from 'drizzle-orm'
import { scheduleChanges, settings, notificationLogs } from '../../db/schema'
import type { ScheduleChange } from '../../db/schema'
import { useDb } from '../../utils/db'

// 每日課表異動彙整通知（見 specs/0025）。
// GitHub Actions cron 每天 08:00（台灣）帶 Bearer 金鑰呼叫 → 撈未通知的異動 → 去重 → push 到 LINE 群組。
// 本端點需公開讓 cron 打得到，靠 Bearer 金鑰把關，不走使用者 session。

type Db = ReturnType<typeof useDb>

interface Survivor {
  action: string
  classroom: string
  summary: string
}

const ACTION_EMOJI: Record<string, string> = {
  created: '➕',
  updated: '✏️',
  deleted: '🗑️'
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)

  // Bearer 金鑰驗證
  const auth = getHeader(event, 'authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!config.notifyCronSecret || token !== config.notifyCronSecret) {
    throw createError({ statusCode: 401, statusMessage: 'unauthorized' })
  }

  const db = useDb(event)

  // 撈未通知的異動（依時間排序，id 作為次序 tie-breaker 確保去重結果穩定）
  const pending = await db
    .select()
    .from(scheduleChanges)
    .where(isNull(scheduleChanges.notifiedAt))
    .orderBy(scheduleChanges.createdAt, scheduleChanges.id)

  if (pending.length === 0) {
    return { sent: false, reason: 'no_changes' }
  }

  const survivors = resolveChanges(pending)
  const allIds = pending.map(c => c.id)

  // 全部互相抵銷（期間內新增又刪除）→ 標記已通知、不發送
  if (survivors.length === 0) {
    await markNotified(db, allIds)
    return { sent: false, reason: 'no_effective_changes' }
  }

  // 檢查設定：群組 ID + access token
  const [groupRow] = await db.select().from(settings).where(eq(settings.key, LINE_GROUP_ID_KEY))
  const groupId = groupRow?.value
  if (!groupId || !config.lineChannelAccessToken) {
    // 尚未設定：不標記，設定好後下次 cron 即可送出
    return { sent: false, reason: 'not_configured' }
  }

  const text = buildDigestMessage(survivors)
  const result = await linePush(config.lineChannelAccessToken, groupId, [{ type: 'text', text }])

  await db.insert(notificationLogs).values({
    channel: 'line',
    target: groupId,
    status: result.success ? 'success' : 'failed',
    errorMessage: result.error ?? null
  })

  if (!result.success) {
    // 發送失敗：不標記，下次 cron 自動重試整批
    return { sent: false, reason: 'send_failed', error: result.error }
  }

  await markNotified(db, allIds)
  return { sent: true, count: survivors.length }
})

// 依 (entityType, entityId) 去重取淨結果；entityId=0（如批次匯入）視為各自獨立、不合併。
function resolveChanges(rows: ScheduleChange[]): Survivor[] {
  const groups = new Map<string, ScheduleChange[]>()
  for (const r of rows) {
    const key = r.entityId > 0 ? `${r.entityType}:${r.entityId}` : `raw:${r.id}`
    const arr = groups.get(key)
    if (arr) arr.push(r)
    else groups.set(key, [r])
  }

  const out: Survivor[] = []
  for (const arr of groups.values()) {
    const last = arr[arr.length - 1] // rows 已排序，最後一筆即最新狀態
    if (!last) continue
    const hasCreated = arr.some(r => r.action === 'created')
    let action: string
    if (last.action === 'deleted') {
      if (hasCreated) continue // 期間內新增又刪除 → 淨變化為零，略過
      action = 'deleted'
    } else {
      action = hasCreated ? 'created' : 'updated' // 多次修改 → 一筆修改；新增(後續修改) → 新增
    }
    out.push({ action, classroom: last.classroom, summary: last.summary })
  }
  return out
}

// 依教室分組組成文字訊息
function buildDigestMessage(items: Survivor[]): string {
  const byRoom = new Map<string, Survivor[]>()
  for (const it of items) {
    const arr = byRoom.get(it.classroom)
    if (arr) arr.push(it)
    else byRoom.set(it.classroom, [it])
  }

  // 以台灣時間（UTC+8）取當日日期
  const tw = new Date(Date.now() + 8 * 3600 * 1000)
  const header = `📅 課表異動通知（${tw.getUTCMonth() + 1}/${tw.getUTCDate()}）`

  const blocks: string[] = []
  for (const [room, arr] of byRoom) {
    const lines = arr.map(it => `${ACTION_EMOJI[it.action] ?? '•'} ${it.summary}`).join('\n')
    blocks.push(`【${room}】\n${lines}`)
  }
  return `${header}\n\n${blocks.join('\n\n')}`
}

async function markNotified(db: Db, ids: number[]): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  await db.update(scheduleChanges).set({ notifiedAt: now }).where(inArray(scheduleChanges.id, ids))
}
