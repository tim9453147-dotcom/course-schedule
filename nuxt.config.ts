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

  // 把肥大的 FullCalendar 拆成獨立 chunk，避免主包超過 500kB 警告、並改善首屏載入。
  // 只作用於 client build（$client）：SSR build 關閉 code-splitting，設 manualChunks 會被警告。
  vite: {
    $client: {
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              fullcalendar: [
                '@fullcalendar/core',
                '@fullcalendar/daygrid',
                '@fullcalendar/timegrid',
                '@fullcalendar/interaction',
                '@fullcalendar/vue3'
              ]
            }
          }
        }
      }
    }
  },

  runtimeConfig: {
    // 伺服器端可用，預設空字串，由環境變數覆寫：
    //   NUXT_ADMIN_USERNAME / NUXT_ADMIN_PASSWORD
    // session 加密用 NUXT_SESSION_PASSWORD（nuxt-auth-utils 自動讀取）
    adminUsername: '',
    adminPassword: '',
    // Gemini 圖片辨識匯入（免費方案）：NUXT_GEMINI_API_KEY / NUXT_GEMINI_MODEL
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash',
    // LINE Messaging API（課表異動通知，見 specs/0025）：
    //   NUXT_LINE_CHANNEL_ACCESS_TOKEN（push 訊息）
    //   NUXT_LINE_CHANNEL_SECRET（webhook 簽章驗證）
    lineChannelAccessToken: '',
    lineChannelSecret: '',
    // 每日課表異動彙整通知端點的 Bearer 金鑰（見 specs/0025）：NUXT_NOTIFY_CRON_SECRET
    notifyCronSecret: ''
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
