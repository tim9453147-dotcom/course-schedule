// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    'nuxt-auth-utils',
    'nitro-cloudflare-dev'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  // 深/淺色由全站色系主題（useTheme）控制。用 cookie 儲存偏好：SSR 讀得到，
  // 已設定過的瀏覽器再次載入時伺服器就渲染正確深/淺色、不閃爍。
  // 預設 dark（預設主題「石墨黑」為深色）；首次造訪淺色主題僅該次會短暫閃一下。
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
    storage: 'cookie',
    storageKey: 'cs-color-mode'
  },

  // 部署到 Cloudflare Pages：build 後產生 dist/ (含 _worker.js)
  nitro: {
    preset: 'cloudflare-pages'
  },

  runtimeConfig: {
    // 伺服器端可用，預設空字串，由環境變數覆寫：
    //   NUXT_ADMIN_USERNAME / NUXT_ADMIN_PASSWORD
    // session 加密用 NUXT_SESSION_PASSWORD（nuxt-auth-utils 自動讀取）
    adminUsername: '',
    adminPassword: '',
    // Gemini 圖片辨識匯入（免費方案）：NUXT_GEMINI_API_KEY / NUXT_GEMINI_MODEL
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash'
  },

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
