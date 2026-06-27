import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { normalizeDomain } from "../src/normalizer.js";
import { buildIndexBuffer, DomainIndex } from "../src/index.js";

describe("fuzz normalizer", () => {
  it("never throws on arbitrary strings", () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        expect(() => normalizeDomain(input)).not.toThrow();
      }),
    );
  });
});

describe("fuzz lookup", () => {
  it("lookup never throws on normalized or raw input", () => {
    const buffer = buildIndexBuffer({
      domains: ["evil.com", "bad.org"],
      sources: ["fuzz"],
    });
    const index = DomainIndex.fromBuffer(buffer);

    fc.assert(
      fc.property(fc.string({ maxLength: 300 }), (input) => {
        expect(() => index.lookup(input)).not.toThrow();
        const normalized = normalizeDomain(input);
        if (normalized) {
          expect(() => index.lookup(normalized)).not.toThrow();
        }
      }),
    );
  });
});
