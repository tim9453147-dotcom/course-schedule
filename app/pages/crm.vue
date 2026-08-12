<script setup lang="ts">
import { ref } from 'vue'

// 名單頁：需取得 CRM 權限才能看到。兩個分頁——
//   每日任務（個人名單表，融合今日跟進智慧提醒，ProspectWorksheet）／ 總名單（原 CRM，ContactList）

const activeTab = ref('daily')

const tabItems = [
  { label: '每日任務', icon: 'i-lucide-list-todo', slot: 'daily', value: 'daily' },
  { label: '總名單', icon: 'i-lucide-contact', slot: 'contacts', value: 'contacts' }
]
</script>

<template>
  <UContainer class="py-4 sm:py-8 px-3 sm:px-6">
    <UTabs
      v-model="activeTab"
      :items="tabItems"
      class="w-full"
    >
      <template #daily>
        <ProspectWorksheet v-if="activeTab === 'daily'" />
      </template>

      <template #contacts>
        <ContactList v-if="activeTab === 'contacts'" />
      </template>
    </UTabs>
  </UContainer>
</template>
