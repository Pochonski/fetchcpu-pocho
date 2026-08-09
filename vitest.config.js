import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: "tests/**/*.test.js",
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["js/**/*.js"],
      exclude: [
        "js/**/index.js",          // re-export only — exercised by tests through consumers
        "node_modules/**",
      ],
      reporter: ["text", "html"],
    },
  },
});
