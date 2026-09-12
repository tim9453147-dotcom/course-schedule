<script setup lang="ts">
// Dark Tech 深淺切換鈕（spec 0032）：以 View Transitions 整頁交叉淡入（沿用 spec 0020 的平滑過渡）。
// 不支援或使用者要求減少動態時，直接切換。
const colorMode = useColorMode()

function toggle(): void {
  const next = colorMode.value === 'dark' ? 'light' : 'dark'
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion || !document.startViewTransition) {
    colorMode.preference = next
    return
  }
  document.startViewTransition(() => {
    colorMode.preference = next
    return nextTick()
  })
}
</script>

<template>
  <UButton
    :icon="colorMode.value === 'dark' ? 'i-lucide-moon' : 'i-lucide-sun'"
    color="neutral"
    variant="ghost"
    :aria-label="colorMode.value === 'dark' ? '切換為淺色模式' : '切換為深色模式'"
    @click="toggle"
  />
</template>
