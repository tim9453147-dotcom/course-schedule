// LINE Messaging API 相關工具（課表異動通知，見 specs/0025）。
// 不用 SDK，直接 fetch，符合 Cloudflare Workers 相容性（比照 events/ai-extract.post.ts）。

// settings 表用來存機器人所在群組 ID 的 key
export const LINE_GROUP_ID_KEY = 'line_group_id'

const LINE_API = 'https://api.line.me/v2/bot/message'

export interface LineTextMessage {
  type: 'text'
  text: string
}

// 驗證 LINE webhook 的 x-line-signature：對 raw body 以 channel secret 做 HMAC-SHA256、base64。
// 用 Web Crypto（Workers 原生），不依賴 node:crypto。
export async function verifyLineSignature(
  channelSecret: string,
  rawBody: string,
  signature: string | undefined
): Promise<boolean> {
  if (!signature) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(channelSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)))
  return expected === signature
}

// 回覆訊息（用 webhook 事件的 replyToken，免費、不計入推播量）
export async function lineReply(
  accessToken: string,
  replyToken: string,
  messages: LineTextMessage[]
): Promise<{ success: boolean, error?: string }> {
  return linePost(`${LINE_API}/reply`, accessToken, { replyToken, messages })
}

// 主動推播到指定對象（群組 ID / 使用者 ID）
export async function linePush(
  accessToken: string,
  to: string,
  messages: LineTextMessage[]
): Promise<{ success: boolean, error?: string }> {
  return linePost(`${LINE_API}/push`, accessToken, { to, messages })
}

async function linePost(
  url: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<{ success: boolean, error?: string }> {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(body)
    })
  } catch {
    return { success: false, error: 'network_error' }
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    return { success: false, error: `line_api_${res.status}:${detail}`.slice(0, 300) }
  }
  return { success: true }
}
