<script setup lang="ts">
const { loggedIn, user, session, clear } = useUserSession();
const toast = useToast();
const route = useRoute();

const isSuper = computed(() => session.value?.isSuperAdmin === true);

// 導覽列顯示哪些頁面：public 永遠顯示；private 需超級管理員或被授權
const visiblePages = computed(() =>
  PAGES.filter((p) => {
    if (p.access === "public") return true;
    if (isSuper.value) return true;
    return loggedIn.value && (session.value?.pages ?? []).includes(p.key);
  })
);

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
            v-for="p in visiblePages"
            :key="p.key"
            :to="p.path"
            :icon="p.icon"
            :color="route.path === p.path ? 'primary' : 'neutral'"
            :variant="route.path === p.path ? 'soft' : 'ghost'"
            class="font-bold"
          >
            {{ p.label }}
          </UButton>
          <UButton
            v-if="isSuper"
            to="/admin"
            icon="i-lucide-users-round"
            :color="route.path === '/admin' ? 'primary' : 'neutral'"
            :variant="route.path === '/admin' ? 'soft' : 'ghost'"
            class="font-bold"
          >
            使用者管理
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
        <template v-else>
          <UButton
            to="/apply"
            icon="i-lucide-user-plus"
            color="neutral"
            variant="ghost"
          >
            申請帳號
          </UButton>
          <UButton
            to="/login"
            icon="i-lucide-log-in"
            color="neutral"
            variant="ghost"
          >
            登入
          </UButton>
        </template>
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
