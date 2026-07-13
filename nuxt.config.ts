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

  // 本機開發伺服器 port
  devServer: {
    port: 1125
  },

  css: ['~/assets/css/main.css'],

  // 深/淺色由「季節×時段」主題於執行期驅動（app/plugins/seasonal-theme.ts）。
  // 這裡的 preference/fallback 僅為首屏 fallback；storage 用 cookie 讓已造訪者 SSR 就渲染正確深/淺。
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
