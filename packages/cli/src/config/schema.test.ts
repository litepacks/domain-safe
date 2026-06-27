import { describe, it, expect } from "vitest";
import { configSchema, DEFAULT_CONFIG } from "./schema.js";

describe("config schema", () => {
  it("validates default config", () => {
    const result = configSchema.parse(DEFAULT_CONFIG);
    expect(result.sources).toEqual(["fabriziosalmi"]);
  });

  it("rejects empty sources", () => {
    expect(() => configSchema.parse({ ...DEFAULT_CONFIG, sources: [] })).toThrow();
  });
});
