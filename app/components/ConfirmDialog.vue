<script setup lang="ts">
// 以 useOverlay 程式化開啟的確認對話框；由 useConfirm() 呼叫。
// OverlayProvider 會用 v-model:open 綁定本元件、並監聽 @close 來 resolve 承諾。
withDefaults(
  defineProps<{
    title: string
    description?: string
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
  }>(),
  {
    description: '',
    confirmLabel: '確定',
    cancelLabel: '取消',
    danger: false
  }
)

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ close: [boolean] }>()
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
    :ui="{ content: 'sm:max-w-md' }"
  >
    <template #body>
      <div class="flex items-start gap-3">
        <div
          class="flex size-10 shrink-0 items-center justify-center rounded-full"
          :class="danger ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'"
        >
          <UIcon
            :name="danger ? 'i-lucide-triangle-alert' : 'i-lucide-help-circle'"
            class="size-5"
          />
        </div>
        <p class="text-sm text-muted pt-2 whitespace-pre-wrap">
          {{ description || '確定要執行這個動作嗎？' }}
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          color="neutral"
          variant="ghost"
          @click="emit('close', false)"
        >
          {{ cancelLabel }}
        </UButton>
        <UButton
          :color="danger ? 'error' : 'primary'"
          @click="emit('close', true)"
        >
          {{ confirmLabel }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
