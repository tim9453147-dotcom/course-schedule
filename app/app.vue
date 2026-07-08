<script setup lang="ts">
const { loggedIn, user, session, clear } = useUserSession();
const notify = useNotify();
const route = useRoute();

const isSuper = computed(() => session.value?.isSuperAdmin === true);

// 全站色系主題下拉（僅超級管理員可見）：選單項目，目前選中者顯示打勾。
// 選取即存回伺服器，之後所有使用者共用。
const { theme, themes, setTheme } = useTheme();
async function pickTheme(id: ThemeId) {
  try {
    await setTheme(id);
    notify.success("已更新全站主題");
  } catch {
    notify.error("更新失敗", "請稍後再試");
  }
}
const themeItems = computed(() =>
  themes.map((t) => ({
    label: t.label,
    icon: t.id === theme.value ? "i-lucide-check" : undefined,
    onSelect: () => pickTheme(t.id),
  })),
);

// 導覽列顯示哪些頁面：public 永遠顯示；private 需超級管理員或被授權
const visiblePages = computed(() =>
  PAGES.filter((p) => {
    if (p.access === "public") return true;
    if (isSuper.value) return true;
    return loggedIn.value && (session.value?.pages ?? []).includes(p.key);
  }),
);

useHead({
  meta: [{ name: "viewport", content: "width=device-width, initial-scale=1" }],
  link: [{ rel: "icon", href: "/favicon.ico" }],
  htmlAttrs: { lang: "zh-Hant" },
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
        <!-- 全站色系主題：僅超級管理員可設定，設定後所有使用者共用 -->
        <UDropdownMenu
          v-if="isSuper"
          :items="themeItems"
          :content="{ align: 'end' }"
        >
          <UButton
            icon="i-lucide-palette"
            color="neutral"
            variant="ghost"
            aria-label="設定全站色系主題"
          >
            <span class="hidden sm:inline">主題</span>
          </UButton>
        </UDropdownMenu>
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
