/**
 * 統一的 toast 提示：頂部置中的膠囊樣式，帶對應 icon 與顏色，無進度條。
 * 用法：const notify = useNotify(); notify.success('已儲存'); notify.error('儲存失敗', msg)
 * 位置與「不顯示進度條」設定在 app.vue 的 <UApp :toaster>。
 */
type NotifyColor = 'success' | 'error' | 'info'

// 覆寫 toast 的 root slot，把預設卡片改成置中膠囊；有說明文字時放寬圓角並改成上緣對齊。
function pillUi(hasDescription: boolean) {
  return {
    // w-fit 讓膠囊縮到內容寬度；CJK 會逐字換行，所以文字強制不換行，w-fit 才會量到整行寬度。
    root: [
      'w-fit max-w-[90vw] mx-auto gap-2 shadow-lg',
      hasDescription
        ? 'rounded-2xl items-start py-2.5 pl-3.5 pr-4'
        : 'rounded-full items-center py-2 pl-3 pr-4'
    ].join(' '),
    wrapper: 'w-auto',
    title: 'whitespace-nowrap',
    description: 'whitespace-nowrap'
  }
}

export function useNotify() {
  const toast = useToast()

  function add(color: NotifyColor, icon: string, title: string, description?: string) {
    toast.add({
      title,
      description,
      color,
      icon,
      close: false,
      progress: false,
      ui: pillUi(!!description)
    })
  }

  return {
    // 成功／確認提示已停用：動作完成後不再跳 toast（僅保留錯誤提示）。
    // 保留相同簽章，呼叫端 notify.success(...) 無需改動。
    success(_title: string, _description?: string) {
    },
    error(title: string, description?: string) {
      add('error', 'i-lucide-circle-alert', title, description)
    },
    info(title: string, description?: string) {
      add('info', 'i-lucide-info', title, description)
    }
  }
}
