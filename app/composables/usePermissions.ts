// 判斷目前登入者對某個頁面是否有「編輯／使用」權限。
// 超級管理員全通；一般使用者看 session.pages。
// 注意：這只控制前端 UI 顯示，後端 API 仍會以 DB 為準再驗一次（最終把關）。
export function useCanEdit(key: string) {
  const { loggedIn, session } = useUserSession()
  return computed(() => {
    if (session.value?.isSuperAdmin) return true
    return loggedIn.value && (session.value?.pages ?? []).includes(key)
  })
}
