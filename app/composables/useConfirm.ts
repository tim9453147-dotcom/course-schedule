import ConfirmDialog from '~/components/ConfirmDialog.vue'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** 危險動作（如刪除）：圖示與確定鈕轉為紅色 */
  danger?: boolean
}

/**
 * 取代瀏覽器原生 confirm()，改用與 App 同風格的對話框。
 * 用法：const confirm = useConfirm(); if (!(await confirm({ title, description, danger: true }))) return
 * 使用者按 Esc／點遮罩關閉時回傳 false。
 */
export function useConfirm() {
  const overlay = useOverlay()
  const modal = overlay.create(ConfirmDialog)

  return async function confirm(options: ConfirmOptions): Promise<boolean> {
    const instance = modal.open(options)
    return (await instance.result) === true
  }
}
