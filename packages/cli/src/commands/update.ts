import { writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { buildIndexBuffer } from "@domain-safe/core";
import { getSource } from "@domain-safe/sources";
import type { DomainSafeConfig } from "../config/schema.js";
import { getIndexPath } from "../config/schema.js";

export interface UpdateResult {
  domainCount: number;
  rawEntries: number;
  durationMs: number;
  indexPath: string;
  sources: string[];
}

export async function runUpdate(config: DomainSafeConfig): Promise<UpdateResult> {
  const start = Date.now();
  const domainSet = new Set<string>();
  const reasons: Record<string, string> = {};
  let rawEntries = 0;

  for (const sourceId of config.sources) {
    console.log(`[debug] Starting download for source: ${sourceId}...`);
    const source = getSource(sourceId);
    const raw = await source.download();
    console.log(`[debug] Downloaded ${raw.length.toLocaleString()} bytes. Parsing...`);
    const entries = source.parse(raw);
    console.log(`[debug] Parsing, normalizing, and inserting entries...`);
    let sourceEntriesCount = 0;

    for (const entry of entries) {
      sourceEntriesCount++;
      const normalized = source.normalize(entry);
      if (!normalized) continue;
      domainSet.add(normalized.domain);
      if (normalized.reason) {
        reasons[normalized.domain] = normalized.reason;
      }
    }
    rawEntries += sourceEntriesCount;
    console.log(`[debug] Processed ${sourceEntriesCount.toLocaleString()} raw entries.`);
    console.log(`[debug] Current unique domains: ${domainSet.size.toLocaleString()}`);
  }

  const domains = [...domainSet];
  const durationMs = Date.now() - start;

  console.log(`[debug] Building binary index buffer for ${domains.length.toLocaleString()} domains...`);
  const buffer = buildIndexBuffer({
    domains,
    sources: config.sources,
    reasons,
    useBloom: config.compression,
    buildStats: {
      rawEntries,
      uniqueDomains: domains.length,
      durationMs,
    },
  });

  const indexPath = getIndexPath(config);
  const tmpPath = `${indexPath}.tmp`;

  await mkdirSafe(dirname(indexPath));
  await writeFile(tmpPath, buffer);
  await rename(tmpPath, indexPath);

  return {
    domainCount: domains.length,
    rawEntries,
    durationMs,
    indexPath,
    sources: config.sources,
  };
}

async function mkdirSafe(dir: string): Promise<void> {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(dir, { recursive: true });
}
