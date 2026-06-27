import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/benchmark.ts"],
  format: ["esm"],
  clean: true,
});
