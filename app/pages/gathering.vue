<script setup lang="ts">
import { ref, computed, watch } from 'vue'

// 家聚點頁（spec 0021）：一頁兩分頁、各自授權。
//   活動紀錄：public，人人（未登入者）皆可觀看；gathering 權才能編輯。
//   食譜列表：private，需 gathering-recipe 權才顯示。
// 僅當有多個分頁時（> 1）才渲染頂部 UTabs 切換列；若只有單一分頁（如未登入時僅活動紀錄），不顯示分頁列直接渲染內容。
const canRecipe = useCanEdit('gathering-recipe')

const activeTab = ref('records')

const tabItems = computed(() => [
  { label: '活動紀錄', icon: 'i-lucide-notebook-pen', slot: 'records', value: 'records', show: true },
  { label: '食譜列表', icon: 'i-lucide-chef-hat', slot: 'recipes', value: 'recipes', show: canRecipe.value }
].filter(t => t.show))

watch(tabItems, (items) => {
  if (items.length && !items.some(t => t.value === activeTab.value)) {
    activeTab.value = items[0]!.value
  }
}, { immediate: true })
</script>

<template>
  <UContainer class="py-4 sm:py-8 px-1.5 sm:px-6 lg:px-8">
    <UTabs
      v-if="tabItems.length > 1"
      v-model="activeTab"
      :items="tabItems"
      class="w-full"
    >
      <template #records>
        <GatheringRecords v-if="activeTab === 'records'" />
      </template>
      <template #recipes>
        <RecipeList v-if="activeTab === 'recipes'" />
      </template>
    </UTabs>
    <template v-else>
      <GatheringRecords v-if="activeTab === 'records'" />
      <RecipeList v-else-if="activeTab === 'recipes'" />
    </template>
  </UContainer>
</template>
