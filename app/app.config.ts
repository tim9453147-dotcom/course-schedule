export default defineAppConfig({
  ui: {
    // 首屏 fallback 色盤；實際 primary/neutral 由「季節×時段」主題於執行期覆寫
    // （app/composables/useSeasonalTheme.ts）。深/淺見 nuxt.config.ts 的 colorMode。
    colors: {
      primary: 'indigo',
      neutral: 'slate'
    }
  }
})
