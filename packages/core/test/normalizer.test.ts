import { describe, it, expect } from "vitest";
import { normalizeDomain, reverseLabels } from "../src/normalizer.js";

describe("normalizeDomain", () => {
  it("lowercases and trims", () => {
    expect(normalizeDomain("  Example.COM  ")).toBe("example.com");
  });

  it("removes trailing dot", () => {
    expect(normalizeDomain("example.com.")).toBe("example.com");
  });

  it("handles punycode IDN", () => {
    expect(normalizeDomain("münchen.de")).toBe("xn--mnchen-3ya.de");
  });

  it("rejects invalid domains", () => {
    expect(normalizeDomain("not-a-domain")).toBeNull();
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain("-bad.com")).toBeNull();
  });

  it("strips www when option set", () => {
    expect(normalizeDomain("www.example.com", { stripWww: true })).toBe("example.com");
  });
});

describe("reverseLabels", () => {
  it("reverses label order", () => {
    expect(reverseLabels("sub.example.com")).toEqual(["com", "example", "sub"]);
  });
});
