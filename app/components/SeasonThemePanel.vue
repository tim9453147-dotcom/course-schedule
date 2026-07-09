<script setup lang="ts">
// 超級管理員主題預覽面板（spec 0019）：手動覆寫季節/時段，只影響自己這台瀏覽器。
// 型別 Season/Daypart 與 useSeasonalTheme 皆由 Nuxt 自動匯入。
const { theme, auto, override, setSeason, setDaypart, resetAuto } = useSeasonalTheme()

const seasons: { id: Season, label: string }[] = [
  { id: 'spring', label: '春' },
  { id: 'summer', label: '夏' },
  { id: 'autumn', label: '秋' },
  { id: 'winter', label: '冬' }
]
const dayparts: { id: Daypart, label: string }[] = [
  { id: 'dawn', label: '清晨' },
  { id: 'day', label: '白天' },
  { id: 'dusk', label: '黃昏' },
  { id: 'night', label: '夜晚' }
]

const seasonLabel: Record<Season, string> = {
  spring: '春',
  summer: '夏',
  autumn: '秋',
  winter: '冬'
}
const daypartLabel: Record<Daypart, string> = {
  dawn: '清晨',
  day: '白天',
  dusk: '黃昏',
  night: '夜晚'
}

const isAuto = computed(
  () => override.value.season === null && override.value.daypart === null
)
</script>

<template>
  <UPopover>
    <UButton
      icon="i-lucide-palette"
      color="neutral"
      variant="ghost"
      aria-label="主題設定"
    >
      <span class="hidden sm:inline">主題</span>
    </UButton>

    <template #content>
      <div class="w-64 space-y-3 p-4">
        <div class="text-sm text-muted">
          目前自動為：{{ seasonLabel[auto.season] }}・{{
            daypartLabel[auto.daypart]
          }}
        </div>

        <div class="space-y-1">
          <div class="text-xs font-medium text-muted">
            季節
          </div>
          <div class="grid grid-cols-4 gap-1">
            <UButton
              v-for="s in seasons"
              :key="s.id"
              size="sm"
              block
              :color="theme.season === s.id ? 'primary' : 'neutral'"
              :variant="theme.season === s.id ? 'solid' : 'outline'"
              @click="setSeason(s.id)"
            >
              {{ s.label }}
            </UButton>
          </div>
        </div>

        <div class="space-y-1">
          <div class="text-xs font-medium text-muted">
            時段
          </div>
          <div class="grid grid-cols-4 gap-1">
            <UButton
              v-for="d in dayparts"
              :key="d.id"
              size="sm"
              block
              :color="theme.daypart === d.id ? 'primary' : 'neutral'"
              :variant="theme.daypart === d.id ? 'solid' : 'outline'"
              @click="setDaypart(d.id)"
            >
              {{ d.label }}
            </UButton>
          </div>
        </div>

        <UButton
          block
          size="sm"
          color="neutral"
          variant="ghost"
          icon="i-lucide-rotate-ccw"
          :disabled="isAuto"
          @click="resetAuto"
        >
          回到自動
        </UButton>
      </div>
    </template>
  </UPopover>
</template>
