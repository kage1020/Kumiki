import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import Demo from "./Demo.vue";
import Playground from "./Playground.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("Playground", Playground);
    app.component("KumikiDemo", Demo);
  },
} satisfies Theme;
