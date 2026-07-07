export default defineAppConfig({
  ui: {
    // 預設色系主題「石墨黑」的初值（zinc + neutral，深色）。
    // 使用者透過 header 主題下拉切換時，useTheme 會在執行期改寫這裡的
    // primary/neutral，Nuxt UI 即時重繪。
    colors: {
      primary: 'zinc',
      neutral: 'neutral'
    }
  }
})
