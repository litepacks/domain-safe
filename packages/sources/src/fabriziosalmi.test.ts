import { describe, it, expect } from "vitest";
import { FabrizioSalmiSource } from "../src/fabriziosalmi.js";

describe("FabrizioSalmiSource", () => {
  const source = new FabrizioSalmiSource();

  it("has metadata", () => {
    const meta = source.metadata();
    expect(meta.id).toBe("fabriziosalmi");
    expect(meta.url).toContain("blacklist.txt");
  });

  it("parses blacklist format", () => {
    const raw = new TextEncoder().encode(`
# comment
evil.com
phishing-site.net

# another comment
malware.org
    `.trim());

    const entries = [...source.parse(raw)];
    expect(entries).toHaveLength(3);
    expect(entries[0]!.domain).toBe("evil.com");
  });

  it("normalizes entries", () => {
    const result = source.normalize({ domain: "EVIL.COM", source: "fabriziosalmi" });
    expect(result?.domain).toBe("evil.com");
  });

  it("rejects invalid entries", () => {
    expect(source.normalize({ domain: "invalid", source: "fabriziosalmi" })).toBeNull();
  });
});
