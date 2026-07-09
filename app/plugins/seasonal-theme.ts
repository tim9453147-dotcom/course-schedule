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

    // 平滑過渡：用 View Transitions 讓背景漸層 + 色盤 + 深淺一起交叉淡入淡出。
    // 不支援或使用者要求減少動態時，直接套用（維持瞬間切換）。
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const applyWithTransition = () => {
      if (reduceMotion.matches || !document.startViewTransition) {
        apply()
        return
      }
      // 回傳 nextTick 讓 Vue／unhead 把新色盤、.dark、data-season/daypart 都刷進 DOM 後才擷取「新」快照
      document.startViewTransition(() => {
        apply()
        return nextTick()
      })
    }

    // 只在「解析後的主題實際改變」時才過渡套用（避免每 60 秒 tick 觸發無謂動畫）。
    // 用字串鍵：Vue 以值（Object.is）比較，內容不變就不觸發；用陣列會因每次都是新參考而誤觸發。
    watch(
      () => `${theme.value.primary}|${theme.value.neutral}|${theme.value.mode}`,
      () => applyWithTransition()
    )

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
