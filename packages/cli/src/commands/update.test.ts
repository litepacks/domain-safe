import { describe, it, expect } from "vitest";
import { registerSource } from "@domain-safe/sources";
import type { SourceAdapter, RawEntry } from "@domain-safe/sources";
import { runUpdate } from "./update.js";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DomainIndex } from "@domain-safe/core";

describe("runUpdate", () => {
  it("should successfully build index from registered source", async () => {
    const dir = await mkdtemp(join(tmpdir(), "domain-safe-cli-test-"));
    
    // Create a mock source adapter
    const mockSource: SourceAdapter = {
      id: "mock-test-source",
      metadata() {
        return {
          id: "mock-test-source",
          name: "Mock Source",
          url: "http://example.com",
          license: "MIT",
          description: "Mock Source",
        };
      },
      async download() {
        return new TextEncoder().encode("evil-mock-domain.com\n# comment\nanother-evil.com");
      },
      parse(raw) {
        const text = new TextDecoder().decode(raw);
        const entries: RawEntry[] = [];
        for (const line of text.split("\n")) {
          if (!line.trim() || line.startsWith("#")) continue;
          entries.push({
            domain: line.trim(),
            source: this.id,
          });
        }
        return entries;
      },
      normalize(entry) {
        return {
          domain: entry.domain,
          source: entry.source,
        };
      },
    };

    registerSource(mockSource);

    const config = {
      sources: ["mock-test-source"],
      output: dir,
      format: "binary" as const,
      compression: true,
      runtime: {
        autoReload: false,
        watch: false,
      },
    };

    const result = await runUpdate(config);
    expect(result.domainCount).toBe(2);
    expect(result.rawEntries).toBe(2);

    // Verify index was written correctly
    const buffer = await readFile(result.indexPath);
    const index = DomainIndex.fromBuffer(buffer);
    expect(index.domainCount).toBe(2);
    expect(index.lookup("evil-mock-domain.com")).toBe("evil-mock-domain.com");

    await rm(dir, { recursive: true, force: true });
  });
});
