<script setup lang="ts">
const { loggedIn, user, session, clear } = useUserSession();
const notify = useNotify();
const route = useRoute();

const isSuper = computed(() => session.value?.isSuperAdmin === true);

// 導覽列顯示哪些頁面：public 永遠顯示；private 需超級管理員或被授權
const visiblePages = computed(() =>
  PAGES.filter((p) => {
    if (p.nav === false) return false;
    if (p.access === "public") return true;
    if (isSuper.value) return true;
    return loggedIn.value && (session.value?.pages ?? []).includes(p.key);
  }),
);

// 季節/時段掛到 <html> 屬性，供 main.css 選背景漸層（SSR 就寫入）
const { theme: seasonalTheme } = useSeasonalTheme();

useHead({
  meta: [{ name: "viewport", content: "width=device-width, initial-scale=1" }],
  link: [{ rel: "icon", href: "/favicon.ico" }],
  htmlAttrs: {
    lang: "zh-Hant",
    "data-season": computed(() => seasonalTheme.value.season),
    "data-daypart": computed(() => seasonalTheme.value.daypart),
  },
});

useSeoMeta({
  title: "中壢教室",
  description: "中壢教室",
});

async function logout() {
  await clear();
  notify.success("已登出");
  await navigateTo("/");
}

// 修改密碼（僅一般使用者；超級管理員密碼由環境變數設定）
const pwOpen = ref(false);
const pwSaving = ref(false);
const pwForm = reactive({ current: "", next: "", confirm: "" });

function openChangePassword() {
  pwForm.current = "";
  pwForm.next = "";
  pwForm.confirm = "";
  pwOpen.value = true;
}

async function changePassword() {
  if (pwForm.next.length < 6) {
    notify.error("新密碼至少 6 碼");
    return;
  }
  if (pwForm.next !== pwForm.confirm) {
    notify.error("兩次輸入的新密碼不一致");
    return;
  }
  pwSaving.value = true;
  try {
    await $fetch("/api/auth/password", {
      method: "PUT",
      body: { currentPassword: pwForm.current, newPassword: pwForm.next },
    });
    pwOpen.value = false;
    notify.success("密碼已更新");
  } catch (e: unknown) {
    const msg =
      (e as { data?: { message?: string } })?.data?.message ?? "請稍後再試";
    notify.error("修改失敗", msg);
  } finally {
    pwSaving.value = false;
  }
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
          <UButton
            v-if="!isSuper"
            icon="i-lucide-key-round"
            color="neutral"
            variant="ghost"
            @click="openChangePassword"
          >
            <span class="hidden sm:inline">修改密碼</span>
          </UButton>
          <UButton
            icon="i-lucide-log-out"
            color="neutral"
            variant="ghost"
            @click="logout"
          >
            <span class="hidden sm:inline">登出（{{ user?.name }}）</span>
          </UButton>
        </template>
        <template v-else>
          <UButton
            to="/apply"
            icon="i-lucide-user-plus"
            color="neutral"
            variant="ghost"
          >
            <span class="hidden sm:inline">申請帳號</span>
          </UButton>
          <UButton
            to="/login"
            icon="i-lucide-log-in"
            color="neutral"
            variant="ghost"
          >
            <span class="hidden sm:inline">登入</span>
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

    <!-- 修改密碼 -->
    <UModal v-model:open="pwOpen" title="修改密碼">
      <template #body>
        <div class="space-y-4">
          <UFormField label="目前密碼" required>
            <UInput
              v-model="pwForm.current"
              type="password"
              autocomplete="current-password"
              class="w-full"
            />
          </UFormField>
          <UFormField label="新密碼（至少 6 碼）" required>
            <UInput
              v-model="pwForm.next"
              type="password"
              autocomplete="new-password"
              class="w-full"
            />
          </UFormField>
          <UFormField label="確認新密碼" required>
            <UInput
              v-model="pwForm.confirm"
              type="password"
              autocomplete="new-password"
              class="w-full"
              @keyup.enter="changePassword"
            />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="ghost" @click="pwOpen = false">
              取消
            </UButton>
            <UButton :loading="pwSaving" @click="changePassword">儲存</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </UApp>
</template>
