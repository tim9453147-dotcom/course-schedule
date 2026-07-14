import { settings } from '../../db/schema'

// LINE Messaging API webhook（見 specs/0025）。
// 職責：驗證簽章 → 機器人被加進群組 / 群組有訊息時，把 groupId 存進 settings.line_group_id。
// 被加進群組（join）時回一句確認訊息，讓使用者當場知道綁定成功。
// 本端點需公開讓 LINE 平台打得到，靠 x-line-signature 簽章驗證把關。
interface LineSource {
  type: 'user' | 'group' | 'room'
  groupId?: string
  userId?: string
  roomId?: string
}
interface LineEvent {
  type: string
  replyToken?: string
  source?: LineSource
  message?: { type: string, text?: string }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)

  // 尚未設定 secret：無法驗證簽章，直接回 200 不處理（避免 LINE 平台判定失敗）
  if (!config.lineChannelSecret) {
    return { ok: true, skipped: 'not_configured' }
  }

  const rawBody = (await readRawBody(event, 'utf8')) || ''
  const signature = getHeader(event, 'x-line-signature')
  const valid = await verifyLineSignature(config.lineChannelSecret, rawBody, signature)
  if (!valid) {
    throw createError({ statusCode: 401, statusMessage: 'invalid signature' })
  }

  const payload = JSON.parse(rawBody || '{}') as { events?: LineEvent[] }
  const events = payload.events ?? []
  const db = useDb(event)

  for (const ev of events) {
    // 只在來源是群組時記錄 groupId（本專案通知固定發到單一群組）
    const groupId = ev.source?.type === 'group' ? ev.source.groupId : undefined
    if (groupId) {
      await db
        .insert(settings)
        .values({ key: LINE_GROUP_ID_KEY, value: groupId })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: groupId, updatedAt: Math.floor(Date.now() / 1000) }
        })

      // 被加進群組時回一句確認，讓使用者當場知道綁定成功
      if (ev.type === 'join' && ev.replyToken && config.lineChannelAccessToken) {
        await lineReply(config.lineChannelAccessToken, ev.replyToken, [
          { type: 'text', text: '✅ 已綁定此群組，之後課表有異動會在每天早上 8 點通知這裡。' }
        ])
      }
    }
  }

  return { ok: true }
})
