import { describe, it, expect } from "vitest";
import { URLHausSource } from "./urlhaus.js";

describe("URLHausSource", () => {
  const source = new URLHausSource();

  it("has metadata", () => {
    const meta = source.metadata();
    expect(meta.id).toBe("urlhaus");
    expect(meta.url).toContain("urlhaus.abuse.ch");
  });

  it("parses hostfile format", () => {
    const raw = new TextEncoder().encode(`
# comment
127.0.0.1\tmalware.example.com
127.0.0.1\tsub.bad.net
    `.trim());

    const entries = source.parse(raw);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.domain).toBe("malware.example.com");
    expect(entries[0]!.reason).toBe("malware");
  });

  it("normalizes entries", () => {
    const result = source.normalize({
      domain: "MALWARE.EXAMPLE.COM",
      source: "urlhaus",
      reason: "malware",
    });
    expect(result?.domain).toBe("malware.example.com");
  });

  it("rejects IP-only lines", () => {
    expect(
      source.normalize({ domain: "192.168.1.1", source: "urlhaus" }),
    ).toBeNull();
  });
});
