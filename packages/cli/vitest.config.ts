import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    fs: {
      // Allow Vitest to serve generated bundles dropped into test-tmp/.
      strict: false,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["test/**/*.test.ts"],
  },
});
