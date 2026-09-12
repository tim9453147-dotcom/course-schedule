export default defineAppConfig({
  ui: {
    // Dark Tech 單一風格（spec 0032）：sky 主色 + zinc 中性色。
    // 深/淺由 colorMode（header 的 UColorModeButton）切換，色盤不變、明暗令片段見 main.css。
    colors: {
      primary: 'gray',
      neutral: 'zinc'
    }
  }
})
