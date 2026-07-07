// 啟動時載入並套用全站色系主題（通用 plugin：SSR 就套好 accent、避免閃爍）。
// 深/淺色：@nuxtjs/color-mode 的 client plugin 會在 app:mounted 把 preference 重設成
// inline helper（cookie）的值；首次造訪（無 cookie）預設是 dark，會蓋掉我們的設定。
// 因此在 app:mounted 後用 nextTick 補套一次，確保晚於 color-mode 的重設而生效。
// 已造訪過的瀏覽器 cookie 已同步，SSR 直接渲染正確深/淺色、不閃。
export default defineNuxtPlugin(async (nuxtApp) => {
  const { load, applyMode, theme } = useTheme();
  await load();
  if (import.meta.client) {
    nuxtApp.hook("app:mounted", () => {
      nextTick(() => applyMode(theme.value));
    });
  }
});
