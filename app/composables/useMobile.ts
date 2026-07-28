// 簡易手機偵測（響應式）：回傳 isMobile（< 640px = Tailwind sm 斷點）
export function useMobile() {
  const isMobile = ref(false)

  if (import.meta.client) {
    const mq = window.matchMedia('(max-width: 639px)')
    isMobile.value = mq.matches
    const handler = (e: MediaQueryListEvent) => {
      isMobile.value = e.matches
    }
    mq.addEventListener('change', handler)
    onScopeDispose(() => mq.removeEventListener('change', handler))
  }

  return { isMobile }
}
