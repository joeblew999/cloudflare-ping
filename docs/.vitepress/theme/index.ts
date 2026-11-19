// VitePress's own theme, in Void's colours (custom.css), with the live parts of the docs:
// <LatestRuns /> reads the app's API as the pages and the CLI do.
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import LatestRuns from "./LatestRuns.vue";
import "./custom.css";

const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("LatestRuns", LatestRuns);
  },
};

export default theme;
