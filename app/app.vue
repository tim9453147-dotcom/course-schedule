<script setup lang="ts">
const { loggedIn, user, clear } = useUserSession();
const toast = useToast();
const route = useRoute();

useHead({
  meta: [{ name: "viewport", content: "width=device-width, initial-scale=1" }],
  link: [{ rel: "icon", href: "/favicon.ico" }],
  htmlAttrs: { lang: "zh-Hant" },
});

useSeoMeta({
  title: "教室課表",
  description: "教室課表",
});

async function logout() {
  await clear();
  toast.add({ title: "已登出", color: "success" });
  await navigateTo("/");
}
</script>

<template>
  <UApp>
    <UHeader>
      <template #left>
        <nav class="flex items-center gap-1">
          <UButton
            to="/"
            icon="i-lucide-calendar-days"
            :color="route.path === '/' ? 'primary' : 'neutral'"
            :variant="route.path === '/' ? 'soft' : 'ghost'"
            class="font-bold"
          >
            教室課表
          </UButton>
          <UButton
            to="/equipment"
            icon="i-lucide-package"
            :color="route.path === '/equipment' ? 'primary' : 'neutral'"
            :variant="route.path === '/equipment' ? 'soft' : 'ghost'"
            class="font-bold"
          >
            器材室管理
          </UButton>
        </nav>
      </template>

      <template #right>
        <UColorModeButton />

        <template v-if="loggedIn">
          <UButton color="neutral" variant="ghost" @click="logout">
            登出（{{ user?.name }}）
          </UButton>
        </template>
        <UButton
          v-else
          to="/login"
          icon="i-lucide-log-in"
          color="neutral"
          variant="ghost"
        >
          管理員登入
        </UButton>
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>

    <UFooter>
      <template #left>
        <p class="text-sm text-muted">
          Built with Nuxt + Cloudflare • © {{ new Date().getFullYear() }}
        </p>
      </template>
    </UFooter>
  </UApp>
</template>
