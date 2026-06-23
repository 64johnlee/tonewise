import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      include: ["lib/**/*.js"],
      // dynamo.js and google-auth.js are I/O wrappers exercised via integration,
      // not unit-covered here; the pure logic lives in the helpers we do test.
      exclude: ["lib/dynamo.js", "lib/google-auth.js"],
    },
  },
});
