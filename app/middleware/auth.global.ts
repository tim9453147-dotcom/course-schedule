// 路由守門：保護管理者頁與「登入限定」頁面。
// 後端 API 仍各自強制權限；這層只是避免無權者看到頁面。
export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn, session } = useUserSession()
  const isSuper = session.value?.isSuperAdmin === true
  const pages = session.value?.pages ?? []

  // 管理者頁：只有超級管理員
  if (to.path === '/admin' && !isSuper) {
    return navigateTo('/')
  }

  // 登入限定頁（access: 'private'）：需超級管理員，或已登入且被授權
  const page = pageByPath(to.path)
  if (page?.access === 'private') {
    const ok = isSuper || (loggedIn.value && pages.includes(page.key))
    if (!ok) return navigateTo('/')
  }
})
