// 依當前時間（或網址 query 強制值）解析主題，並套用到 Nuxt UI 的 appConfig.ui.colors 與 colorMode。
// now 為反應式時間戳，由 plugin 定時更新，跨過季節/時段邊界時自動重算。
// 型別／函式（Season, Daypart, ResolvedTheme, nowParts, resolveTheme, isSeason, isDaypart）皆由 shared/ 自動匯入。
export function useSeasonalTheme() {
  const appConfig = useAppConfig()
  const colorMode = useColorMode()
  const route = useRoute()

  // SSR 用當下時間初始化，payload 帶到 client（不重取）→ 首屏一致不閃。
  const now = useState<number>('cs-now', () => Date.now())

  // 網址 query 強制指定（僅供截圖驗證，非使用者 UI）：?season=autumn&daypart=dusk
  const forced = computed(() => ({
    season: isSeason(route.query.season) ? (route.query.season as Season) : null,
    daypart: isDaypart(route.query.daypart) ? (route.query.daypart as Daypart) : null
  }))

  const theme = computed<ResolvedTheme>(() => {
    const auto = nowParts(new Date(now.value))
    return resolveTheme({
      season: forced.value.season ?? auto.season,
      daypart: forced.value.daypart ?? auto.daypart
    })
  })

  // 套用 primary/neutral（改 appConfig，SSR 就生效、accent 不閃）
  function applyColors(): void {
    appConfig.ui.colors.primary = theme.value.primary
    appConfig.ui.colors.neutral = theme.value.neutral
  }

  // 套用深/淺（交給 color-mode）
  function applyMode(): void {
    colorMode.preference = theme.value.mode
  }

  function apply(): void {
    applyColors()
    applyMode()
  }

  return { theme, now, apply, applyMode }
}
