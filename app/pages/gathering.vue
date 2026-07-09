<script setup lang="ts">
// 家聚點頁（spec 0021）：一頁三分頁、各自授權。
//   活動紀錄（public，人人可看，gathering 權才能編輯）
//   收支紀錄（private，需 gathering-finance 權才顯示）
//   食譜列表（private，需 gathering-recipe 權才顯示）
// 路由為 public（PAGES 的 gathering），故不掛 auth middleware；分頁依權限動態組出。
const canFinance = useCanEdit('gathering-finance')
const canRecipe = useCanEdit('gathering-recipe')

const tabItems = computed(() => [
  { label: '收支紀錄', icon: 'i-lucide-wallet', slot: 'finance', value: 'finance', show: canFinance.value },
  { label: '活動紀錄', icon: 'i-lucide-notebook-pen', slot: 'records', value: 'records', show: true },
  { label: '食譜列表', icon: 'i-lucide-chef-hat', slot: 'recipes', value: 'recipes', show: canRecipe.value }
].filter(t => t.show))

// 預設分頁：有收支權先看收支，否則看活動紀錄
const defaultTab = computed(() => (canFinance.value ? 'finance' : 'records'))
</script>

<template>
  <UContainer class="py-8">
    <UTabs
      :items="tabItems"
      :default-value="defaultTab"
      class="w-full"
    >
      <template #finance>
        <GatheringFinance />
      </template>
      <template #records>
        <GatheringRecords />
      </template>
      <template #recipes>
        <RecipeList />
      </template>
    </UTabs>
  </UContainer>
</template>
