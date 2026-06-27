import { describe, it, expect } from "vitest";
import { buildIndexBuffer, DomainIndex, DomainSafe, HEADER_SIZE, HDR } from "../src/index.js";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEST_DOMAINS = [
  "evil.com",
  "phishing.example.org",
  "malware-site.net",
  "bad.domain.co.uk",
];

describe("binary index", () => {
  it("builds and reads index with checksum", () => {
    const buffer = buildIndexBuffer({
      domains: TEST_DOMAINS,
      sources: ["test"],
      useBloom: true,
    });
    const index = DomainIndex.fromBuffer(buffer);
    expect(index.domainCount).toBe(TEST_DOMAINS.length);
    expect(index.metadata.sources).toEqual(["test"]);
  });

  it("performs suffix lookup", () => {
    const buffer = buildIndexBuffer({
      domains: ["evil.com"],
      sources: ["test"],
      useBloom: true,
    });
    const index = DomainIndex.fromBuffer(buffer);

    expect(index.lookup("evil.com")).toBe("evil.com");
    expect(index.lookup("sub.evil.com")).toBe("evil.com");
    expect(index.lookup("deep.sub.evil.com")).toBe("evil.com");
    expect(index.lookup("safe.com")).toBeNull();
  });

  it("detects corrupt checksum", () => {
    const buffer = buildIndexBuffer({
      domains: TEST_DOMAINS,
      sources: ["test"],
    });
    buffer[HEADER_SIZE] = buffer[HEADER_SIZE]! ^ 0xff;
    expect(() => DomainIndex.fromBuffer(buffer)).toThrow(/Checksum mismatch/);
    expect(() => DomainIndex.fromBuffer(buffer, { verifyChecksum: false })).not.toThrow();
  });

  it("uses zero-copy bloom view", () => {
    const buffer = buildIndexBuffer({
      domains: TEST_DOMAINS,
      sources: ["test"],
      useBloom: true,
    });
    const index = DomainIndex.fromBuffer(buffer);
    expect(index.bloom).not.toBeNull();
    expect(index.bloom!.bits.buffer).toBe(index.buffer.buffer);
  });

  it("defers metadata parse until accessed", () => {
    const buffer = buildIndexBuffer({
      domains: TEST_DOMAINS,
      sources: ["test"],
      useBloom: true,
    });
    const index = DomainIndex.fromBuffer(buffer);
    expect(index.lookup("evil.com")).toBe("evil.com");
    expect(index.metadata.sources).toEqual(["test"]);
  });
});

describe("DomainSafe", () => {
  it("loads from disk and looks up domains", async () => {
    const dir = await mkdtemp(join(tmpdir(), "domain-safe-"));
    const dbPath = join(dir, "index.bin");

    try {
      const buffer = buildIndexBuffer({
        domains: TEST_DOMAINS,
        sources: ["test"],
      });
      await writeFile(dbPath, buffer);

      const safe = await DomainSafe.load({
        dbPath,
        autoReload: false,
        watch: false,
      });

      expect(safe.lookup("evil.com").listed).toBe(true);
      expect(safe.lookup("sub.evil.com").listed).toBe(true);
      expect(safe.lookup("google.com").listed).toBe(false);

      const batch = safe.batchLookup(["evil.com", "google.com"]);
      expect(batch).toHaveLength(2);
      expect(batch[0]!.listed).toBe(true);
      expect(batch[1]!.listed).toBe(false);

      const stats = safe.stats();
      expect(stats.domainCount).toBe(TEST_DOMAINS.length);

      safe.close();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("hot reloads index atomically", async () => {
    const dir = await mkdtemp(join(tmpdir(), "domain-safe-reload-"));
    const dbPath = join(dir, "index.bin");

    try {
      await writeFile(
        dbPath,
        buildIndexBuffer({ domains: ["old.com"], sources: ["test"] }),
      );

      const safe = await DomainSafe.load({
        dbPath,
        autoReload: false,
        watch: false,
      });

      expect(safe.lookup("old.com").listed).toBe(true);
      expect(safe.lookup("new.com").listed).toBe(false);

      await writeFile(
        dbPath,
        buildIndexBuffer({ domains: ["new.com"], sources: ["test"] }),
      );

      await safe.reload();
      expect(safe.lookup("new.com").listed).toBe(true);
      expect(safe.lookup("old.com").listed).toBe(false);

      safe.close();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reloads without checksum when verifyChecksumOnReload is false", async () => {
    const dir = await mkdtemp(join(tmpdir(), "domain-safe-fast-reload-"));
    const dbPath = join(dir, "index.bin");

    try {
      await writeFile(
        dbPath,
        buildIndexBuffer({ domains: ["fast.com"], sources: ["test"] }),
      );

      const safe = await DomainSafe.load({
        dbPath,
        autoReload: false,
        watch: false,
        verifyChecksumOnReload: false,
      });

      const buffer = buildIndexBuffer({ domains: ["fast.com"], sources: ["test"] });
      const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      view.setUint32(HDR.CHECKSUM, 0xdeadbeef, true);
      await writeFile(dbPath, buffer);

      await safe.reload();
      expect(safe.lookup("fast.com").listed).toBe(true);

      safe.close();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("large fixture", () => {
  it("handles 100k synthetic domains", () => {
    const domains: string[] = [];
    for (let i = 0; i < 100_000; i++) {
      domains.push(`bad-${i}.test-blocklist.local`);
    }

    const buffer = buildIndexBuffer({
      domains,
      sources: ["synthetic"],
      useBloom: true,
    });

    const index = DomainIndex.fromBuffer(buffer);
    expect(index.domainCount).toBe(100_000);
    expect(index.lookup("bad-50000.test-blocklist.local")).toBe(
      "bad-50000.test-blocklist.local",
    );
    expect(index.lookup("safe.example.com")).toBeNull();
  });
});
