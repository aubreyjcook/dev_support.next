/**
 * Theme constants shared by the server-rendered layout and the client toggle.
 *
 * The stored value is only ever `light` or `dark` when the user has made an
 * explicit choice. `system` (or a missing value) means "no attribute", and the
 * CSS `prefers-color-scheme` media query takes over.
 */
export const THEME_STORAGE_KEY = "helpdesk-theme";

/**
 * Inline, render-blocking script injected into `<head>`.
 *
 * Runs synchronously before the first paint, so a user who picked dark mode
 * never sees a flash of the light theme — while the page itself stays fully
 * static and prerenderable. Deliberately does nothing for `system`: that case
 * is already handled by CSS.
 */
export const THEME_INIT_SCRIPT = [
  "(function(){try{",
  `var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});`,
  'if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}',
  "}catch(e){}})()",
].join("");
