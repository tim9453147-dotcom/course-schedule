<script setup lang="ts">
interface AdminUser {
  id: number
  username: string
  displayName: string
  status: 'pending' | 'approved' | 'rejected' | 'disabled'
  pages: string[]
  note: string | null
  createdAt: number
  approvedAt: number | null
}

const toast = useToast()
const { data: users, refresh } = await useFetch<AdminUser[]>('/api/users', {
  default: () => []
})

const statusMeta: Record<string, { label: string, color: 'warning' | 'success' | 'neutral' | 'error' }> = {
  pending: { label: '待審核', color: 'warning' },
  approved: { label: '已啟用', color: 'success' },
  rejected: { label: '已拒絕', color: 'neutral' },
  disabled: { label: '已停用', color: 'error' }
}

const pendingUsers = computed(() => users.value.filter(u => u.status === 'pending'))
const otherUsers = computed(() => users.value.filter(u => u.status !== 'pending'))

async function patch(id: number, body: Record<string, unknown>, okMsg?: string) {
  try {
    await $fetch(`/api/users/${id}`, { method: 'PUT', body })
    await refresh()
    if (okMsg) toast.add({ title: okMsg, color: 'success' })
  } catch (e: unknown) {
    const msg = (e as { data?: { message?: string } })?.data?.message ?? '請稍後再試'
    toast.add({ title: '操作失敗', description: msg, color: 'error' })
  }
}

async function togglePage(u: AdminUser, key: string, val: boolean) {
  const next = val ? [...new Set([...u.pages, key])] : u.pages.filter(k => k !== key)
  await patch(u.id, { pages: next }, '已更新權限')
}

async function setStatus(u: AdminUser, status: AdminUser['status'], msg: string) {
  await patch(u.id, { status }, msg)
}

async function resetPassword(u: AdminUser) {
  const pw = window.prompt(`為「${u.displayName}」設定新密碼（至少 6 碼）`)
  if (pw == null) return
  if (pw.length < 6) {
    toast.add({ title: '密碼至少 6 碼', color: 'error' })
    return
  }
  await patch(u.id, { password: pw }, '已重設密碼')
}

async function removeUser(u: AdminUser) {
  if (!window.confirm(`確定刪除帳號「${u.username}」？此動作無法復原。`)) return
  try {
    await $fetch(`/api/users/${u.id}`, { method: 'DELETE' })
    await refresh()
    toast.add({ title: '已刪除', color: 'success' })
  } catch {
    toast.add({ title: '刪除失敗', color: 'error' })
  }
}
</script>

<template>
  <UContainer class="py-8 space-y-8">
    <h1 class="text-2xl font-bold">
      使用者管理
    </h1>

    <!-- 待審核申請 -->
    <section class="space-y-3">
      <h2 class="text-lg font-semibold flex items-center gap-2">
        待審核申請
        <UBadge v-if="pendingUsers.length" color="warning" variant="soft">
          {{ pendingUsers.length }}
        </UBadge>
      </h2>

      <p v-if="!pendingUsers.length" class="text-sm text-muted">
        目前沒有待審核的申請。
      </p>

      <UCard v-for="u in pendingUsers" :key="u.id">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-1">
            <p class="font-semibold">
              {{ u.displayName }}
              <span class="text-muted font-normal">（{{ u.username }}）</span>
            </p>
            <p v-if="u.note" class="text-sm text-muted">
              說明：{{ u.note }}
            </p>
          </div>
          <div class="flex gap-2">
            <UButton color="success" size="sm" @click="setStatus(u, 'approved', '已通過，請設定可用頁面')">
              通過
            </UButton>
            <UButton color="neutral" variant="soft" size="sm" @click="setStatus(u, 'rejected', '已拒絕')">
              拒絕
            </UButton>
          </div>
        </div>
      </UCard>
    </section>

    <!-- 所有帳號 -->
    <section class="space-y-3">
      <h2 class="text-lg font-semibold">
        所有帳號
      </h2>

      <p v-if="!otherUsers.length" class="text-sm text-muted">
        尚無已審核的帳號。
      </p>

      <UCard v-for="u in otherUsers" :key="u.id">
        <div class="space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="font-semibold flex items-center gap-2">
              {{ u.displayName }}
              <span class="text-muted font-normal">（{{ u.username }}）</span>
              <UBadge :color="statusMeta[u.status]?.color" variant="soft">
                {{ statusMeta[u.status]?.label }}
              </UBadge>
            </p>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-if="u.status === 'approved'"
                color="warning"
                variant="soft"
                size="sm"
                @click="setStatus(u, 'disabled', '已停用')"
              >
                停用
              </UButton>
              <UButton
                v-else
                color="success"
                variant="soft"
                size="sm"
                @click="setStatus(u, 'approved', '已啟用')"
              >
                啟用
              </UButton>
              <UButton color="neutral" variant="soft" size="sm" @click="resetPassword(u)">
                重設密碼
              </UButton>
              <UButton color="error" variant="ghost" size="sm" @click="removeUser(u)">
                刪除
              </UButton>
            </div>
          </div>

          <!-- 頁面權限 -->
          <div>
            <p class="text-sm text-muted mb-1">
              可用頁面
            </p>
            <div class="flex flex-wrap gap-4">
              <UCheckbox
                v-for="p in PAGES"
                :key="p.key"
                :model-value="u.pages.includes(p.key)"
                :label="p.access === 'public' ? `${p.label}（可編輯）` : `${p.label}（可使用）`"
                @update:model-value="(val: boolean | 'indeterminate') => togglePage(u, p.key, val === true)"
              />
            </div>
          </div>
        </div>
      </UCard>
    </section>
  </UContainer>
</template>
