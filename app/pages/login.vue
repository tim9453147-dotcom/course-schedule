<script setup lang="ts">
import { z } from 'zod'

const schema = z.object({
  username: z.string().min(1, '請輸入帳號'),
  password: z.string().min(1, '請輸入密碼')
})
type Schema = z.output<typeof schema>

const state = reactive({ username: '', password: '' })
const loading = ref(false)
const toast = useToast()
const { fetch: refreshSession } = useUserSession()

async function onSubmit() {
  loading.value = true
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: state })
    await refreshSession()
    toast.add({ title: '登入成功', color: 'success' })
    await navigateTo('/')
  } catch {
    toast.add({ title: '登入失敗', description: '帳號或密碼錯誤', color: 'error' })
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
          管理員登入
        </h1>
      </template>

      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="帳號" name="username">
          <UInput v-model="state.username" class="w-full" autocomplete="username" />
        </UFormField>

        <UFormField label="密碼" name="password">
          <UInput
            v-model="state.password"
            type="password"
            class="w-full"
            autocomplete="current-password"
          />
        </UFormField>

        <UButton type="submit" block :loading="loading">
          登入
        </UButton>
      </UForm>
    </UCard>
  </UContainer>
</template>
