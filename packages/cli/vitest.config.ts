import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    fs: {
      // Allow Vitest to serve generated bundles dropped into test-tmp/.
      strict: false,
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["test/**/*.test.ts"],
  },
});
