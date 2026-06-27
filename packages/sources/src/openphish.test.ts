import { describe, it, expect } from "vitest";
import { OpenPhishSource } from "./openphish.js";

describe("OpenPhishSource", () => {
  const source = new OpenPhishSource();

  it("has metadata", () => {
    const meta = source.metadata();
    expect(meta.id).toBe("openphish");
    expect(meta.url).toContain("openphish.com/feed.txt");
  });

  it("parses URL feed", () => {
    const raw = new TextEncoder().encode(`
https://phishing.example.com/login
http://evil-bank.net/verify
    `.trim());

    const entries = [...source.parse(raw)];
    expect(entries).toHaveLength(2);
    expect(entries[0]!.domain).toBe("https://phishing.example.com/login");
    expect(entries[0]!.reason).toBe("phishing");
  });

  it("extracts domain from URL on normalize", () => {
    const result = source.normalize({
      domain: "https://PHISHING.EXAMPLE.COM/path",
      source: "openphish",
      reason: "phishing",
    });
    expect(result?.domain).toBe("phishing.example.com");
  });

  it("rejects invalid URLs", () => {
    expect(source.normalize({ domain: "not-a-domain", source: "openphish" })).toBeNull();
  });
});
