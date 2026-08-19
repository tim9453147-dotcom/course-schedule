<script setup lang="ts">
// 超級管理員主題設定與預覽面板（spec 0019 / 0026）：
// 1. 全站風格切換：季節時刻 vs 黑色科技（Dark Modern），儲存至全站 settings。
// 2. 季節時刻模式下：手動預覽季節/時段，只影響自己這台瀏覽器。
// 型別 Season/Daypart/SiteTheme 與 useSeasonalTheme 皆由 Nuxt 自動匯入。
const { theme, siteTheme, auto, override, setSiteTheme, setSeason, setDaypart, resetAuto } = useSeasonalTheme()
const notify = useNotify()

const isSavingTheme = ref(false)

const siteThemes: { id: SiteTheme, label: string, icon: string }[] = [
  { id: 'seasonal', label: '季節時刻', icon: 'i-lucide-sparkles' },
  { id: 'dark_modern', label: '黑色科技', icon: 'i-lucide-code-xml' }
]

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

async function handleThemeChange(newTheme: SiteTheme) {
  if (siteTheme.value === newTheme || isSavingTheme.value) return
  isSavingTheme.value = true
  try {
    await setSiteTheme(newTheme)
    notify.success(newTheme === 'dark_modern' ? '已切換為黑色科技風格' : '已切換為季節時刻風格')
  } catch {
    notify.error('切換全站主題失敗')
  } finally {
    isSavingTheme.value = false
  }
}
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
      <div class="w-72 space-y-4 p-4">
        <!-- 全站風格切換 -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-muted">全站風格</span>
            <span class="text-[11px] text-muted">（全站生效）</span>
          </div>
          <div class="grid grid-cols-2 gap-1.5">
            <UButton
              v-for="st in siteThemes"
              :key="st.id"
              size="sm"
              block
              :icon="st.icon"
              :color="siteTheme === st.id ? 'primary' : 'neutral'"
              :variant="siteTheme === st.id ? 'solid' : 'outline'"
              :loading="isSavingTheme && siteTheme !== st.id"
              @click="handleThemeChange(st.id)"
            >
              {{ st.label }}
            </UButton>
          </div>
        </div>

        <USeparator />

        <!-- 季節時刻模式下的詳細選項 -->
        <template v-if="siteTheme === 'seasonal'">
          <div class="text-xs text-muted">
            目前自動判定：<span class="font-medium text-highlighted">{{ seasonLabel[auto.season] }}・{{ daypartLabel[auto.daypart] }}</span>
          </div>

          <div class="space-y-1">
            <div class="text-xs font-medium text-muted">
              季節預覽
            </div>
            <div class="grid grid-cols-4 gap-1">
              <UButton
                v-for="s in seasons"
                :key="s.id"
                size="xs"
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
              時段預覽
            </div>
            <div class="grid grid-cols-4 gap-1">
              <UButton
                v-for="d in dayparts"
                :key="d.id"
                size="xs"
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
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-rotate-ccw"
            :disabled="isAuto"
            @click="resetAuto"
          >
            回到自動
          </UButton>
        </template>

        <!-- 黑色科技模式下的說明 -->
        <template v-else>
          <div class="rounded-md bg-elevated/50 p-2.5 text-xs text-muted space-y-1">
            <div class="flex items-center gap-1.5 font-medium text-highlighted">
              <UIcon
                name="i-lucide-info"
                class="size-3.5 text-primary"
              />
              <span>VS Code Dark Modern</span>
            </div>
            <p class="leading-relaxed">
              全站鎖定深色模式、經典冷灰底色與高亮藍點綴。
            </p>
          </div>
        </template>
      </div>
    </template>
  </UPopover>
</template>
