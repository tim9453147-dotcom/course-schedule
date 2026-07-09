// 依當前時間（或網址 query 強制值）解析主題，並套用到 Nuxt UI 的 appConfig.ui.colors 與 colorMode。
// now 為反應式時間戳，由 plugin 定時更新，跨過季節/時段邊界時自動重算。
// 型別／函式（Season, Daypart, ResolvedTheme, nowParts, resolveTheme, isSeason, isDaypart）皆由 shared/ 自動匯入。
export function useSeasonalTheme() {
  const appConfig = useAppConfig()
  const colorMode = useColorMode()
  const route = useRoute()

  // SSR 用當下時間初始化，payload 帶到 client（不重取）→ 首屏一致不閃。
  const now = useState<number>('cs-now', () => Date.now())

  // 手動覆寫（超級管理員預覽用；null = 依時間自動）。
  // 初始值沿用網址 ?season=&daypart= 當作驗證後門，行為與 spec 0018 相同。
  const override = useState<{ season: Season | null, daypart: Daypart | null }>('cs-theme-override', () => ({
    season: isSeason(route.query.season) ? (route.query.season as Season) : null,
    daypart: isDaypart(route.query.daypart) ? (route.query.daypart as Daypart) : null
  }))

  // 依當前時間自動判定（未覆寫時採用，也供面板顯示「目前自動為」）
  const auto = computed(() => nowParts(new Date(now.value)))

  const theme = computed<ResolvedTheme>(() =>
    resolveTheme({
      season: override.value.season ?? auto.value.season,
      daypart: override.value.daypart ?? auto.value.daypart
    })
  )

  // 覆寫設定（僅超級管理員面板呼叫）；plugin 的 watch(theme) 會自動重繪。
  function setSeason(season: Season): void {
    override.value = { ...override.value, season }
  }
  function setDaypart(daypart: Daypart): void {
    override.value = { ...override.value, daypart }
  }
  function resetAuto(): void {
    override.value = { season: null, daypart: null }
  }

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

  return { theme, auto, override, now, apply, applyMode, setSeason, setDaypart, resetAuto }
}
