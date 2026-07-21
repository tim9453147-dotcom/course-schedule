import { eq, isNull, inArray } from 'drizzle-orm'
import { scheduleChanges, settings, notificationLogs } from '../../db/schema'
import type { ScheduleChange } from '../../db/schema'
import { useDb } from '../../utils/db'
import type { TodayInfo, TodayItem } from '../../utils/todaySchedule'

// 每日通知（見 specs/0025、0026）。
// GitHub Actions cron 每天 08:00（台灣）帶 Bearer 金鑰呼叫 → 組「今日課表 + 近期異動」→ push 到 LINE 群組。
// 今天有課/活動 或 有未通知異動 才發送；本端點需公開讓 cron 打得到，靠 Bearer 金鑰把關。

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
  const today = getTaiwanToday()

  // 今日課表（課程 + 活動，跨教室）
  const grouped = await collectTodaySchedule(db, today)
  const todayCount = grouped.reduce((n, g) => n + g.items.length, 0)

  // 未通知異動（依時間排序，id 作次序 tie-breaker 確保去重穩定）→ 去重取淨結果
  const pending = await db
    .select()
    .from(scheduleChanges)
    .where(isNull(scheduleChanges.notifiedAt))
    .orderBy(scheduleChanges.createdAt, scheduleChanges.id)
  const survivors = resolveChanges(pending)
  const allIds = pending.map(c => c.id)

  // 今天沒課/活動、也沒有效異動 → 不發送（把已撈出的異動列標記，避免抵銷列殘留）
  if (todayCount === 0 && survivors.length === 0) {
    if (allIds.length > 0) await markNotified(db, allIds)
    return { sent: false, reason: 'no_changes' }
  }

  // 檢查設定：群組 ID + access token
  const [groupRow] = await db.select().from(settings).where(eq(settings.key, LINE_GROUP_ID_KEY))
  const groupId = groupRow?.value
  if (!groupId || !config.lineChannelAccessToken) {
    // 尚未設定：不標記，設定好後下次 cron 即可送出
    return { sent: false, reason: 'not_configured' }
  }

  const text = buildMessage(grouped, todayCount, survivors, today)
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

  if (allIds.length > 0) await markNotified(db, allIds)
  return { sent: true, todayCount, changeCount: survivors.length }
})

// 組合整則訊息：今日課表區塊 +（有異動時）近期異動區塊
function buildMessage(
  grouped: { classroom: string, items: TodayItem[] }[],
  todayCount: number,
  survivors: Survivor[],
  today: TodayInfo
): string {
  const parts: string[] = []
  if (todayCount > 0) {
    parts.push(buildTodayScheduleBlock(grouped, today))
  }
  if (survivors.length > 0) {
    const body = buildChangesBody(survivors)
    // 有今日課表 → 異動接在分隔線下作為子區塊；否則沿用 0025 的獨立標頭
    parts.push(todayCount > 0
      ? `━━━━━━━━━━\n🔔 近期異動\n\n${body}`
      : `📅 課表異動通知（${today.month}/${today.day}）\n\n${body}`)
  }
  return parts.join('\n\n')
}

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

// 異動內容（依教室分組，無標頭），供 buildMessage 併入
function buildChangesBody(items: Survivor[]): string {
  const byRoom = new Map<string, Survivor[]>()
  for (const it of items) {
    const arr = byRoom.get(it.classroom)
    if (arr) arr.push(it)
    else byRoom.set(it.classroom, [it])
  }
  const blocks: string[] = []
  for (const [room, arr] of byRoom) {
    const lines = arr.map(it => `${ACTION_EMOJI[it.action] ?? '•'} ${it.summary}`).join('\n')
    blocks.push(`【${room}】\n${lines}`)
  }
  return blocks.join('\n\n')
}

async function markNotified(db: Db, ids: number[]): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  await db.update(scheduleChanges).set({ notifiedAt: now }).where(inArray(scheduleChanges.id, ids))
}
