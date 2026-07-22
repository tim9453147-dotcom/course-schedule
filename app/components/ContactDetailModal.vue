<script setup lang="ts">
// 總名單對象的「個人名單表明細」編輯 modal（誰的朋友、開發夥伴、聯絡方式、新人資訊、等級、狀態）。
// 總名單列與每日任務列都用它；儲存後 PATCH 該 contact 並回傳更新後的 contact。
const props = defineProps<{ open: boolean, contact: Contact | null }>()
const emit = defineEmits<{ 'update:open': [boolean], 'saved': [Contact] }>()
const notify = useNotify()

// reka-ui SelectItem 不允許空字串值：清除用哨兵，未設以 placeholder 呈現。
const LEVEL_NONE = '__none__'
const levelItems = [
  ...PROSPECT_LEVEL_OPTIONS.map(l => ({ label: l, value: l })),
  { label: '清除', value: LEVEL_NONE }
]

const form = reactive({
  friendOf: '',
  devPartner: '',
  contact: '',
  info: '',
  level: '',
  status: ''
})
const saving = ref(false)

// 「誰的朋友／開發夥伴」共用人名選項（單一真相來源，兩個 PersonSelect 共用）。
// 比照 ContactList：本元件已在頁面 Suspense 邊界內（ContactList 亦用 top-level await useFetch）。
const { data: options, refresh: refreshOptions } = await useFetch<ContactOption[]>('/api/contact-options', { deep: true })

async function addOption(label: string) {
  try {
    const created = await $fetch<ContactOption>('/api/contact-options', { method: 'POST', body: { label } })
    if (!(options.value ?? []).some(o => o.id === created.id)) {
      options.value = [...(options.value ?? []), created]
    }
  } catch {
    notify.error('新增選項失敗')
    await refreshOptions()
  }
}

async function removeOption(id: number) {
  const prev = options.value ?? []
  options.value = prev.filter(o => o.id !== id) // 樂觀移除
  try {
    await $fetch(`/api/contact-options/${id}`, { method: 'DELETE' })
  } catch {
    notify.error('刪除選項失敗')
    await refreshOptions()
  }
}

watch(() => props.open, (o) => {
  if (o && props.contact) {
    form.friendOf = props.contact.friendOf ?? ''
    form.devPartner = props.contact.devPartner ?? ''
    form.contact = props.contact.contact ?? ''
    form.info = props.contact.info ?? ''
    form.level = props.contact.level ?? ''
    form.status = props.contact.status ?? ''
  }
})

function setLevel(v: string) {
  form.level = (!v || v === LEVEL_NONE) ? '' : v
}

async function save() {
  if (!props.contact) return
  saving.value = true
  try {
    const updated = await $fetch<Contact>(`/api/contacts/${props.contact.id}`, {
      method: 'PATCH',
      body: {
        friendOf: form.friendOf,
        devPartner: form.devPartner,
        contact: form.contact,
        info: form.info,
        level: form.level,
        status: form.status
      }
    })
    emit('saved', updated)
    emit('update:open', false)
    notify.success('已更新明細')
  } catch (err: unknown) {
    const msg = (err as { statusMessage?: string })?.statusMessage ?? '請檢查欄位內容'
    notify.error('更新失敗', msg)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="`編輯明細 — ${contact?.name ?? ''}`"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="誰的朋友">
            <PersonSelect
              v-model="form.friendOf"
              :options="options ?? []"
              @add="addOption"
              @delete="removeOption"
            />
          </UFormField>
          <UFormField label="開發夥伴">
            <PersonSelect
              v-model="form.devPartner"
              :options="options ?? []"
              @add="addOption"
              @delete="removeOption"
            />
          </UFormField>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="聯絡方式">
            <UInput
              v-model="form.contact"
              class="w-full"
            >
              <template #trailing>
                <UButton
                  v-if="form.contact"
                  icon="i-lucide-x"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  aria-label="清除"
                  @click="form.contact = ''"
                />
              </template>
            </UInput>
          </UFormField>
          <UFormField label="等級">
            <USelect
              :model-value="form.level"
              :items="levelItems"
              placeholder="未設"
              class="w-full"
              @update:model-value="setLevel($event as string)"
            />
          </UFormField>
        </div>
        <UFormField label="新人資訊">
          <UTextarea
            v-model="form.info"
            class="w-full"
            :rows="2"
          >
            <template #trailing>
              <UButton
                v-if="form.info"
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="清除"
                @click="form.info = ''"
              />
            </template>
          </UTextarea>
        </UFormField>
        <UFormField label="狀態（織網表）">
          <UInput
            v-model="form.status"
            class="w-full"
          >
            <template #trailing>
              <UButton
                v-if="form.status"
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="清除"
                @click="form.status = ''"
              />
            </template>
          </UInput>
        </UFormField>
        <div class="flex justify-end gap-2 pt-2">
          <UButton
            color="neutral"
            variant="ghost"
            @click="emit('update:open', false)"
          >
            取消
          </UButton>
          <UButton
            :loading="saving"
            @click="save"
          >
            儲存
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
