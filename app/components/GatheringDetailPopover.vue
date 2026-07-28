<script setup lang="ts">
import { ref } from 'vue'
import { dateLabel, timeLabel } from '~/utils/schedule'

export interface GatheringDetail {
  id: number
  name: string
  date: string
  startTime: string | null
  endTime: string | null
  location: string | null
  mapUrl: string | null
  cook: string | null
  assistant: string | null
  shopper: string | null
  process: string | null
  attendees: string | null
  recipeId: number | null
  note: string | null
  fin: {
    headcount: number | null
    fee: number | null
    expense: number | null
    income: number
    profit: number
  } | null
}

defineProps<{
  detail: GatheringDetail
  canEdit: boolean
  recipe?: { name: string, ingredients: string | null, steps: string | null } | null
}>()

const emit = defineEmits<{
  edit: []
  delete: []
}>()

const showRecipe = ref(false)
const money = (n: number) => n.toLocaleString('zh-TW')

const ROLES = [
  { key: 'cook' as const, label: '操鍋' },
  { key: 'assistant' as const, label: '助手' },
  { key: 'shopper' as const, label: '採買' }
]
</script>

<template>
  <div class="w-full max-w-sm sm:w-[22rem] p-4">
    <!-- 標題列：顏色點＋標題，右側編輯/刪除 -->
    <div class="flex items-start gap-2">
      <span
        class="mt-1.5 size-3 shrink-0 rounded-full bg-primary"
      />
      <h3 class="flex-1 text-base font-semibold leading-6">
        {{ detail.name }}
      </h3>
      <div
        v-if="canEdit"
        class="flex shrink-0 gap-1"
      >
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

    <!-- 日期 / 時間 / 地點 -->
    <div class="mt-3 space-y-2 text-sm">
      <div class="flex items-center gap-2 text-muted">
        <UIcon
          name="i-lucide-clock"
          class="size-4 shrink-0"
        />
        <span class="text-default font-medium">
          {{ dateLabel(detail.date) }} · {{ timeLabel(detail.startTime, detail.endTime) }}
        </span>
      </div>

      <div
        v-if="detail.location"
        class="flex items-center gap-2 text-muted"
      >
        <UIcon
          name="i-lucide-map-pin"
          class="size-4 shrink-0"
        />
        <span class="text-default">{{ detail.location }}</span>
        <a
          v-if="detail.mapUrl"
          :href="detail.mapUrl"
          target="_blank"
          rel="noopener"
          class="text-primary ml-auto inline-flex items-center gap-1 text-xs"
        >
          <UIcon name="i-lucide-external-link" />地圖
        </a>
      </div>
    </div>

    <!-- 家聚分工人員（操鍋/助手/採買） -->
    <div
      v-if="ROLES.some(r => detail[r.key])"
      class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm bg-elevated/40 p-2 rounded-lg border border-default/50"
    >
      <template
        v-for="r in ROLES"
        :key="r.key"
      >
        <div
          v-if="detail[r.key]"
          class="flex items-center gap-1"
        >
          <span class="text-muted text-xs">{{ r.label }}：</span>
          <span class="text-default font-medium">{{ detail[r.key] }}</span>
        </div>
      </template>
    </div>

    <!-- 引用食譜 -->
    <div
      v-if="recipe"
      class="mt-3 space-y-1"
    >
      <div class="text-muted text-xs">
        料理食譜
      </div>
      <UButton
        variant="soft"
        color="primary"
        icon="i-lucide-chef-hat"
        size="xs"
        class="w-full justify-between"
        @click="showRecipe = !showRecipe"
      >
        <span>{{ recipe.name }}</span>
        <UIcon :name="showRecipe ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" />
      </UButton>
      <div
        v-if="showRecipe"
        class="bg-elevated/60 mt-1 space-y-2 rounded-lg p-2.5 text-xs border border-default/50"
      >
        <div>
          <span class="font-semibold text-primary">食材：</span>
          <p class="whitespace-pre-wrap text-muted mt-0.5">
            {{ recipe.ingredients || '—' }}
          </p>
        </div>
        <div>
          <span class="font-semibold text-primary">作法：</span>
          <p class="whitespace-pre-wrap text-muted mt-0.5">
            {{ recipe.steps || '—' }}
          </p>
        </div>
      </div>
    </div>

    <!-- 流程紀錄 -->
    <div
      v-if="detail.process"
      class="mt-3 space-y-1 text-sm"
    >
      <div class="text-muted text-xs flex items-center gap-1">
        <UIcon name="i-lucide-list-checks" /> 流程
      </div>
      <p class="whitespace-pre-wrap text-xs bg-elevated/40 p-2 rounded-lg text-default border border-default/50">
        {{ detail.process }}
      </p>
    </div>

    <!-- 參加名單 -->
    <div
      v-if="detail.attendees"
      class="mt-3 space-y-1 text-sm"
    >
      <div class="text-muted text-xs flex items-center gap-1">
        <UIcon name="i-lucide-users" /> 參加名單
      </div>
      <p class="whitespace-pre-wrap text-xs bg-elevated/40 p-2 rounded-lg text-default border border-default/50">
        {{ detail.attendees }}
      </p>
    </div>

    <!-- 備註 -->
    <div
      v-if="detail.note"
      class="mt-3 flex items-start gap-2 text-sm text-muted"
    >
      <UIcon
        name="i-lucide-align-left"
        class="mt-0.5 size-4 shrink-0"
      />
      <span class="whitespace-pre-wrap text-xs text-default">{{ detail.note }}</span>
    </div>

    <!-- 收支盈餘摘要（僅 canEdit 時顯示） -->
    <div
      v-if="canEdit && detail.fin"
      class="mt-3 pt-2.5 border-t border-default flex items-center justify-between text-xs"
    >
      <div class="flex items-center gap-1 text-muted">
        <UIcon name="i-lucide-wallet" />
        <span>家聚盈餘</span>
      </div>
      <div
        class="font-mono font-semibold tabular-nums text-sm"
        :class="detail.fin.profit >= 0 ? 'text-success' : 'text-error'"
      >
        {{ detail.fin.profit >= 0 ? '+' : '−' }}{{ money(Math.abs(detail.fin.profit)) }}
      </div>
    </div>
  </div>
</template>
