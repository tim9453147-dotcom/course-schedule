<script setup lang="ts">
import { ref, computed } from 'vue'

// 家聚點頁（spec 0021 → 本次合併）：一頁兩分頁、各自授權。
//   活動紀錄（public，人人可看；gathering 權才能編輯活動與收支）
//   食譜列表（private，需 gathering-recipe 權才顯示）
// 路由為 public（PAGES 的 gathering），故不掛 auth middleware；分頁依權限動態組出。
const canRecipe = useCanEdit('gathering-recipe')

const activeTab = ref('records')

const tabItems = computed(() => [
  { label: '活動紀錄', icon: 'i-lucide-notebook-pen', slot: 'records', value: 'records', show: true },
  { label: '食譜列表', icon: 'i-lucide-chef-hat', slot: 'recipes', value: 'recipes', show: canRecipe.value }
].filter(t => t.show))
</script>

<template>
  <UContainer class="py-8">
    <UTabs
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
  </UContainer>
</template>
