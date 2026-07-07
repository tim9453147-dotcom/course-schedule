/**
 * 全站色系主題（由超級管理員設定，所有使用者共用）。
 * - 主題清單／型別／驗證在 shared/utils/themes.ts（前後端共用，自動匯入）。
 * - 套用 = 改 appConfig.ui.colors（primary/neutral）+ colorMode.preference，Nuxt UI 即時重繪。
 * - load()：啟動時（SSR 抓一次，payload 帶到 client）讀 /api/settings/theme 並套用。
 * - setTheme()：僅超級管理員；PUT 存回伺服器後即時套用。
 *
 * 註：depth/淺色的初次套用要等 @nuxtjs/color-mode 初始化完才會生效，否則會被它重設，
 * 所以 plugin 會在 app:mounted 後再呼叫 applyMode() 補一次（見 app/plugins/theme.ts）。
 */
export function useTheme() {
  const theme = useState<ThemeId>("cs-theme", () => DEFAULT_THEME);
  const appConfig = useAppConfig();
  const colorMode = useColorMode();

  function themeById(id: ThemeId) {
    return THEMES.find((t) => t.id === id) ?? THEMES[0];
  }

  // 套用 primary/neutral 調色盤（SSR 就生效，accent 不閃）。
  function applyColors(id: ThemeId): void {
    const t = themeById(id);
    appConfig.ui.colors.primary = t.primary;
    appConfig.ui.colors.neutral = t.neutral;
  }

  // 套用深/淺色（交給 colorMode）。
  function applyMode(id: ThemeId): void {
    colorMode.preference = themeById(id).mode;
  }

  function apply(id: ThemeId): void {
    applyColors(id);
    applyMode(id);
  }

  // 啟動時載入全站主題並套用。useAsyncData 讓 SSR 抓一次、client 用 payload 不重抓。
  async function load(): Promise<void> {
    const { data } = await useAsyncData("global-theme", () =>
      $fetch("/api/settings/theme"),
    );
    const id = isThemeId(data.value?.theme) ? data.value.theme : DEFAULT_THEME;
    theme.value = id;
    apply(id);
  }

  // 超級管理員：更新全站主題 → 存回伺服器 → 即時套用。
  async function setTheme(id: ThemeId): Promise<void> {
    await $fetch("/api/settings/theme", { method: "PUT", body: { theme: id } });
    theme.value = id;
    apply(id);
  }

  return { theme, themes: THEMES, load, setTheme, applyMode };
}
