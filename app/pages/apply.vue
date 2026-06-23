<script setup lang="ts">
import { z } from 'zod'

const schema = z.object({
  username: z.string().min(1, '請輸入帳號'),
  displayName: z.string().min(1, '請輸入顯示名稱'),
  password: z.string().min(6, '密碼至少 6 碼'),
  note: z.string().optional()
})

const state = reactive({ username: '', displayName: '', password: '', note: '' })
const loading = ref(false)
const submitted = ref(false)
const toast = useToast()

async function onSubmit() {
  loading.value = true
  try {
    await $fetch('/api/auth/apply', { method: 'POST', body: state })
    submitted.value = true
  } catch (e: unknown) {
    const msg = (e as { data?: { message?: string } })?.data?.message ?? '請稍後再試'
    toast.add({ title: '申請失敗', description: msg, color: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UContainer class="py-16 flex justify-center">
    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-lg font-bold">
          申請帳號
        </h1>
      </template>

      <div v-if="submitted" class="space-y-4 text-center py-4">
        <UIcon name="i-lucide-check-circle" class="text-4xl text-success" />
        <p class="text-sm">
          申請已送出，請等待管理者審核通過後即可登入。
        </p>
        <UButton to="/" variant="soft" block>
          回首頁
        </UButton>
      </div>

      <UForm v-else :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="帳號（建議用 email）" name="username">
          <UInput v-model="state.username" class="w-full" autocomplete="username" />
        </UFormField>

        <UFormField label="顯示名稱" name="displayName">
          <UInput v-model="state.displayName" class="w-full" />
        </UFormField>

        <UFormField label="密碼" name="password">
          <UInput
            v-model="state.password"
            type="password"
            class="w-full"
            autocomplete="new-password"
          />
        </UFormField>

        <UFormField label="申請說明（選填）" name="note">
          <UTextarea v-model="state.note" class="w-full" :rows="2" />
        </UFormField>

        <UButton type="submit" block :loading="loading">
          送出申請
        </UButton>

        <p class="text-xs text-muted text-center">
          已有帳號？<ULink to="/login">前往登入</ULink>
        </p>
      </UForm>
    </UCard>
  </UContainer>
</template>
