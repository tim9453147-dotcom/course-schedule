<script setup lang="ts">
// 可挑/可加/可刪的地點輸入（UInputMenu 包裝），用於名單地點。
// 存純文字地點；選項清單由父層持有並持久化，本元件只呈現與發事件。
const props = defineProps<{ modelValue: string, options: ContactLocation[] }>()
const emit = defineEmits<{
  'update:modelValue': [string]
  'add': [string] // 使用者輸入的新地點，父層負責 POST 持久化
  'delete': [number] // 要刪除的選項 id，父層負責 DELETE
}>()

// UInputMenu 以字串清單呈現；刪除時用 label 反查 id。
const items = computed(() => props.options.map(o => o.label))

// 受控展開：點輸入框（或聚焦）就打開下拉選單
const open = ref(false)
function openMenu() {
  open.value = true
}

const value = computed({
  get: () => props.modelValue,
  set: (v: string) => emit('update:modelValue', v ?? '')
})

function itemLabel(item: unknown): string {
  return typeof item === 'string' ? item : String((item as { label?: string })?.label ?? '')
}

function onCreate(label: string) {
  emit('add', label)
  emit('update:modelValue', label)
}

function onDelete(item: unknown) {
  const label = itemLabel(item)
  const opt = props.options.find(o => o.label === label)
  if (opt) emit('delete', opt.id)
}
</script>

<template>
  <div
    class="w-full"
    @focusin="openMenu"
    @click="openMenu"
  >
    <UInputMenu
      v-model="value"
      v-model:open="open"
      :items="items"
      create-item
      clear
      placeholder="選擇或新增地點"
      class="w-full"
      @create="onCreate"
    >
      <template #item-trailing="{ item }">
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="`刪除選項 ${itemLabel(item)}`"
          @pointerdown.stop.prevent
          @click.stop.prevent="onDelete(item)"
        />
      </template>
    </UInputMenu>
  </div>
</template>
