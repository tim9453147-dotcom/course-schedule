<script setup lang="ts">
// 名單頁：需登入才能看到。兩個分頁——
//   每日任務（個人名單表，ProspectWorksheet）／ 總名單（原 CRM，ContactList）
definePageMeta({ middleware: 'auth' })

const tabItems = [
  { label: '每日任務', icon: 'i-lucide-list-todo', slot: 'daily', value: 'daily' },
  { label: '總名單', icon: 'i-lucide-contact', slot: 'contacts', value: 'contacts' }
]
</script>

<template>
  <UContainer class="py-8">
    <UTabs
      :items="tabItems"
      default-value="daily"
      class="w-full"
    >
      <template #daily>
        <ProspectWorksheet />
      </template>

      <template #contacts>
        <ContactList />
      </template>
    </UTabs>
  </UContainer>
</template>
