<script setup lang="ts">
const { loggedIn, user, session, clear } = useUserSession()
const route = useRoute()

const isSuper = computed(() => session.value?.isSuperAdmin === true)

// 導覽列顯示哪些頁面：public 永遠顯示；private 需超級管理員或被授權
const visiblePages = computed(() =>
  PAGES.filter((p) => {
    if (p.nav === false) return false
    if (p.access === 'public') return true
    if (isSuper.value) return true
    return loggedIn.value && (session.value?.pages ?? []).includes(p.key)
  })
)

// 季節/時段掛到 <html> 屬性，供 main.css 選背景漸層（SSR 就寫入）
const { theme: seasonalTheme } = useSeasonalTheme()

useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: {
    'lang': 'zh-Hant',
    'data-season': computed(() => seasonalTheme.value.season),
    'data-daypart': computed(() => seasonalTheme.value.daypart)
  }
})

useSeoMeta({
  title: '我們獨自升級',
  description: '我們獨自升級'
})

async function logout() {
  await clear()
  window.location.assign('/cdn-cgi/access/logout')
}
</script>

<template>
  <UApp :toaster="{ position: 'top-center', progress: false, duration: 3000 }">
    <UHeader>
      <template #left>
        <nav class="flex items-center gap-1">
          <UButton
            v-for="p in visiblePages"
            :key="p.key"
            :to="p.path"
            :icon="p.icon"
            :color="route.path === p.path ? 'primary' : 'neutral'"
            :variant="route.path === p.path ? 'soft' : 'ghost'"
            class="font-bold"
          >
            <span class="hidden sm:inline">{{ p.label }}</span>
          </UButton>
          <UButton
            v-if="isSuper"
            to="/admin"
            icon="i-lucide-users-round"
            :color="route.path === '/admin' ? 'primary' : 'neutral'"
            :variant="route.path === '/admin' ? 'soft' : 'ghost'"
            class="font-bold"
          >
            <span class="hidden sm:inline">使用者管理</span>
          </UButton>
        </nav>
      </template>

      <template #right>
        <SeasonThemePanel v-if="isSuper" />
        <template v-if="loggedIn">
          <UBadge
            v-if="session?.accountStatus === 'pending'"
            color="warning"
            variant="soft"
          >
            等待管理員開通
          </UBadge>
          <UButton
            icon="i-lucide-log-out"
            color="neutral"
            variant="ghost"
            @click="logout"
          >
            <span class="hidden sm:inline">登出（{{ user?.name }}）</span>
          </UButton>
        </template>
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>

    <UFooter>
      <template #left>
        <p class="text-sm text-muted" />
      </template>
    </UFooter>
  </UApp>
</template>
