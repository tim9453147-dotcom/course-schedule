// 跟進頻率 → 間隔天數。「暫停」或未設定回 null（代表不自動排程）。
export const FOLLOW_UP_FREQ_DAYS: Record<string, number | null> = {
  一週一次: 7,
  兩週一次: 14,
  一個月一次: 30,
  一季一次: 90,
  半年一次: 180,
  暫停: null
}

// 由「最後跟進日 + 頻率」算出下次跟進日（"YYYY-MM-DD"）；無法計算時回 null。
export function computeNextFollowUp(
  lastFollowUp: string | null | undefined,
  freq: string | null | undefined
): string | null {
  if (!lastFollowUp || !freq) return null
  const days = FOLLOW_UP_FREQ_DAYS[freq]
  if (!days) return null
  const d = new Date(`${lastFollowUp}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
