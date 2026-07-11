<script setup lang="ts">
import type { EventDetail } from '~/utils/schedule'
import { colorDot } from '~/utils/schedule'

// 唯讀詳情彈窗：顯示被點課程/活動的資訊；有編輯權才顯示編輯/刪除
defineProps<{
  detail: EventDetail
  canEdit: boolean
}>()

const emit = defineEmits<{
  edit: []
  delete: []
}>()

// 課程角色欄（有值才顯示）
const ROLE_FIELDS: { key: keyof EventDetail, label: string }[] = [
  { key: 'host', label: '主持' },
  { key: 'sharer', label: '分享' },
  { key: 'summarizer', label: '總結' },
  { key: 'pm', label: 'PM' }
]
</script>

<template>
  <div class="w-[min(20rem,calc(100vw-1.5rem))] p-4">
    <!-- 標題列：顏色點＋標題，右側編輯/刪除 -->
    <div class="flex items-start gap-2">
      <span class="mt-1.5 size-3 shrink-0 rounded-full" :class="colorDot(detail.color)" />
      <h3 class="flex-1 text-base font-semibold leading-6">
        {{ detail.title }}
      </h3>
      <div v-if="canEdit" class="flex shrink-0 gap-1">
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="編輯"
          @click="emit('edit')"
        />
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="sm"
          aria-label="刪除"
          @click="emit('delete')"
        />
      </div>
    </div>

    <!-- 日期 / 時間 / 重複 -->
    <div class="mt-3 space-y-2 text-sm">
      <div class="flex items-center gap-2 text-muted">
        <UIcon name="i-lucide-clock" class="size-4 shrink-0" />
        <span class="text-default">
          {{ detail.repeatLabel || detail.dateLabel }} · {{ detail.timeLabel }}
        </span>
      </div>
      <div v-if="detail.location" class="flex items-center gap-2 text-muted">
        <UIcon name="i-lucide-map-pin" class="size-4 shrink-0" />
        <span class="text-default">{{ detail.location }}</span>
      </div>
    </div>

    <!-- 角色（僅課程且有值） -->
    <div
      v-if="detail.kind === 'course' && ROLE_FIELDS.some(f => detail[f.key])"
      class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm"
    >
      <template v-for="f in ROLE_FIELDS" :key="f.key">
        <div v-if="detail[f.key]" class="flex gap-1">
          <span class="text-muted">{{ f.label }}</span>
          <span class="text-default">{{ detail[f.key] }}</span>
        </div>
      </template>
    </div>

    <!-- 備註 -->
    <div v-if="detail.note" class="mt-3 flex items-start gap-2 text-sm text-muted">
      <UIcon name="i-lucide-align-left" class="mt-0.5 size-4 shrink-0" />
      <span class="whitespace-pre-wrap text-default">{{ detail.note }}</span>
    </div>
  </div>
</template>
