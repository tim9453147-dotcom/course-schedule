// 啟動即套用季節/時段主題；client 端定時 + 重新聚焦時更新，跨邊界自動切換。
// 注意：@nuxtjs/color-mode 會在 app:mounted 依 cookie 重設 preference，故掛載後再補套一次 mode（見 spec 0016）。
export default defineNuxtPlugin((nuxtApp) => {
  const { theme, now, apply, applyMode } = useSeasonalTheme()

  // SSR + client 啟動都先套一次（primary/neutral 於 SSR 就正確）
  apply()

  // color-mode 掛載時會覆寫 preference，nextTick 後補套我們的 mode
  nuxtApp.hook('app:mounted', () => {
    nextTick(() => applyMode())
  })

  if (import.meta.client) {
    const tick = () => {
      now.value = Date.now()
    }
    const timer = setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)

    // 時間變動 → theme 重算 → 重新套用
    watch(theme, () => apply())

    // HMR 清理，避免開發時累積 listener/timer
    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        clearInterval(timer)
        document.removeEventListener('visibilitychange', tick)
        window.removeEventListener('focus', tick)
      })
    }
  }
})
