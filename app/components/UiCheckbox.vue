<script setup lang="ts">
// shadcn-vue 風格、可自由客製的 checkbox。底層用專案已內含的 reka-ui，
// 完全受控（畫面只看 model-value），點擊後 emit update:modelValue 由父層決定。
import { CheckboxIndicator, CheckboxRoot, useForwardPropsEmits } from 'reka-ui'
import type { CheckboxRootEmits, CheckboxRootProps } from 'reka-ui'

const props = defineProps<CheckboxRootProps & { class?: string }>()
const emits = defineEmits<CheckboxRootEmits>()

const delegatedProps = computed(() => {
  const { class: _class, ...rest } = props
  return rest
})

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <CheckboxRoot
    v-bind="forwarded"
    :class="[
      'peer inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-[5px] border border-accented bg-default transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-inverted',
      props.class
    ]"
  >
    <CheckboxIndicator class="flex items-center justify-center text-current">
      <UIcon
        name="i-lucide-check"
        class="size-3.5"
      />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
