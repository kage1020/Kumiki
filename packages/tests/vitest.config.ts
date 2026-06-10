import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    // Allow importing the temp bundles the smoke loader writes under .smoke-tmp/.
    fs: { strict: false },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["**/*.test.ts"],
  },
});
