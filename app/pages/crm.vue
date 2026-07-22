<script setup lang="ts">
import { ref } from 'vue'

// 名單頁：需登入才能看到。三個分頁——
//   今日跟進（今日逾期/到期/待啟動名單）、每日任務（個人名單表，ProspectWorksheet）／ 總名單（原 CRM，ContactList）
definePageMeta({ middleware: 'auth' })

const activeTab = ref('today')

const tabItems = [
  { label: '今日跟進', icon: 'i-lucide-target', slot: 'today', value: 'today' },
  { label: '每日任務', icon: 'i-lucide-list-todo', slot: 'daily', value: 'daily' },
  { label: '總名單', icon: 'i-lucide-contact', slot: 'contacts', value: 'contacts' }
]
</script>

<template>
  <UContainer class="py-8">
    <UTabs
      v-model="activeTab"
      :items="tabItems"
      class="w-full"
    >
      <template #today>
        <TodayFollowUp v-if="activeTab === 'today'" />
      </template>

      <template #daily>
        <ProspectWorksheet v-if="activeTab === 'daily'" />
      </template>

      <template #contacts>
        <ContactList v-if="activeTab === 'contacts'" />
      </template>
    </UTabs>
  </UContainer>
</template>
