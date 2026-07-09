// 季節 × 時段 自動主題的單一來源（Nuxt shared/ 前後端自動匯入）。
// season 由月份決定、daypart 由小時決定；resolveTheme() 把兩者組合成一組 Nuxt UI 設定
// （primary/neutral 色盤 + 深/淺）。未來要接天氣 API：擴充 resolveTheme 的入參即可。

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export type Daypart = 'dawn' | 'day' | 'dusk' | 'night'
export type Mode = 'light' | 'dark'

export interface ResolvedTheme {
  season: Season
  daypart: Daypart
  primary: string
  neutral: string
  mode: Mode
}

export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter']
export const DAYPARTS: Daypart[] = ['dawn', 'day', 'dusk', 'night']

// 季節 → Nuxt UI 色盤（primary 主色 / neutral 灰階家族）
export const SEASON_COLORS: Record<Season, { primary: string, neutral: string }> = {
  spring: { primary: 'pink', neutral: 'stone' }, // 櫻花粉嫩
  summer: { primary: 'sky', neutral: 'slate' }, // 晴空碧藍
  autumn: { primary: 'orange', neutral: 'stone' }, // 楓紅琥珀
  winter: { primary: 'indigo', neutral: 'slate' } // 冷冽靛藍/雪白
}

// 時段 → 深/淺色
export const DAYPART_MODE: Record<Daypart, Mode> = {
  dawn: 'light', // 清晨（柔）
  day: 'light', // 白天（明亮）
  dusk: 'dark', // 黃昏（暖色夕陽，深）
  night: 'dark' // 夜晚（深邃）
}

export function isSeason(v: unknown): v is Season {
  return typeof v === 'string' && (SEASONS as string[]).includes(v)
}

export function isDaypart(v: unknown): v is Daypart {
  return typeof v === 'string' && (DAYPARTS as string[]).includes(v)
}

// 月份（1–12）→ 季節（北半球）
export function getSeason(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter' // 12, 1, 2
}

// 小時（0–23）→ 時段
export function getDaypart(hour: number): Daypart {
  if (hour >= 5 && hour < 9) return 'dawn'
  if (hour >= 9 && hour < 17) return 'day'
  if (hour >= 17 && hour < 19) return 'dusk'
  return 'night' // 19–23, 0–4
}

// 以指定時區把 Date 換算成 { season, daypart }。
// 預設 Asia/Taipei：教室都在台灣（UTC+8），SSR（Cloudflare 為 UTC）與瀏覽器算出同一結果 → 換色不閃。
export function nowParts(date: Date, timeZone = 'Asia/Taipei'): { season: Season, daypart: Daypart } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'numeric',
    hour: 'numeric',
    hour12: false
  }).formatToParts(date)
  const month = Number(parts.find(p => p.type === 'month')?.value ?? '1')
  let hour = Number(parts.find(p => p.type === 'hour')?.value ?? '0')
  if (hour === 24) hour = 0 // hour12:false 午夜某些環境回 24
  return { season: getSeason(month), daypart: getDaypart(hour) }
}

// 把季節 + 時段組合成完整主題設定。未來加天氣：多一個入參並在此微調回傳值。
export function resolveTheme(input: { season: Season, daypart: Daypart }): ResolvedTheme {
  const { season, daypart } = input
  return {
    season,
    daypart,
    primary: SEASON_COLORS[season].primary,
    neutral: SEASON_COLORS[season].neutral,
    mode: DAYPART_MODE[daypart]
  }
}
