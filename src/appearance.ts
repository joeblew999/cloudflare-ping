// Light or dark, as VitePress keeps it (the docs): the choice is saved under this key ("dark",
// "light" or "auto"), so choosing in the docs or in the app holds for both (same site).
export const APPEARANCE_KEY = "vitepress-theme-appearance";

// Run before the page paints (middleware/00.head.ts), as VitePress's own: `.dark` on <html>.
export const APPEARANCE_SCRIPT = `;(() => {
  const preference = localStorage.getItem(${JSON.stringify(APPEARANCE_KEY)}) || "auto";
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (preference === "auto" ? prefersDark : preference === "dark")
    document.documentElement.classList.add("dark");
})()`;
