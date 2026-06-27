import pc from "picocolors";
import { DomainSafe } from "@domain-safe/core";
import { getSource, stubSources } from "@domain-safe/sources";
import { access } from "node:fs/promises";
import { loadConfig, getIndexPath } from "../config/index.js";
import { configSchema } from "../config/schema.js";

export async function runCheck(domain: string): Promise<number> {
  const config = await loadConfig();
  const indexPath = getIndexPath(config);

  const safe = await DomainSafe.load({
    dbPath: indexPath,
    autoReload: false,
    watch: false,
  });

  const result = safe.lookup(domain);
  safe.close();

  if (result.listed) {
    console.log(pc.red("✖ Listed"));
    console.log(`Domain: ${result.domain}`);
    if (result.matched) console.log(`Matched: ${result.matched}`);
    if (result.source) console.log(`Source: ${result.source}`);
    if (result.reason) console.log(`Reason: ${result.reason}`);
    return 1;
  }

  console.log(pc.green("✔ Safe"));
  console.log(`Domain: ${result.domain}`);
  return 0;
}

export async function runStats(): Promise<void> {
  const config = await loadConfig();
  const indexPath = getIndexPath(config);

  const safe = await DomainSafe.load({
    dbPath: indexPath,
    autoReload: false,
    watch: false,
  });

  const stats = safe.stats();
  safe.close();

  console.log(pc.bold("domain-safe stats"));
  console.log(`Domains:        ${stats.domainCount.toLocaleString()}`);
  console.log(`Database size:  ${formatBytes(stats.databaseSize)}`);
  console.log(
    `Last update:    ${stats.lastUpdate ? stats.lastUpdate.toISOString() : "unknown"}`,
  );
  console.log(`Enabled sources: ${stats.sources.join(", ") || "none"}`);
  console.log(`Memory estimate: ${formatBytes(stats.memoryEstimate)}`);
  console.log(`Bloom filter:   ${stats.hasBloom ? "enabled" : "disabled"}`);
}

export async function runDoctor(): Promise<number> {
  let ok = true;
  console.log(pc.bold("domain-safe doctor\n"));

  // Config check
  try {
    const config = await loadConfig();
    configSchema.parse(config);
    console.log(pc.green("✔ Configuration valid"));
    console.log(`  Sources: ${config.sources.join(", ")}`);
    console.log(`  Output:  ${config.output}`);
  } catch (err) {
    ok = false;
    console.log(pc.red("✖ Configuration invalid"));
    console.log(`  ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  const config = await loadConfig();
  const indexPath = getIndexPath(config);

  // Index integrity
  try {
    await access(indexPath);
    const safe = await DomainSafe.load({
      dbPath: indexPath,
      autoReload: false,
      watch: false,
    });
    const stats = safe.stats();
    safe.close();
    console.log(pc.green("✔ Index integrity OK"));
    console.log(`  ${stats.domainCount.toLocaleString()} domains indexed`);
  } catch (err) {
    ok = false;
    console.log(pc.red("✖ Index check failed"));
    console.log(`  ${err instanceof Error ? err.message : String(err)}`);
  }

  // Source availability (HEAD request)
  for (const sourceId of config.sources) {
    if (stubSources.includes(sourceId as (typeof stubSources)[number])) {
      console.log(pc.yellow(`⚠ Source "${sourceId}" is not yet implemented`));
      ok = false;
      continue;
    }

    try {
      const source = getSource(sourceId);
      const meta = source.metadata();
      const response = await fetch(meta.url, {
        method: "HEAD",
        headers: { "User-Agent": "domain-safe/0.1.0" },
      });
      if (response.ok) {
        console.log(pc.green(`✔ Source "${sourceId}" reachable`));
      } else {
        ok = false;
        console.log(pc.red(`✖ Source "${sourceId}" returned ${response.status}`));
      }
    } catch (err) {
      ok = false;
      console.log(pc.red(`✖ Source "${sourceId}" unreachable`));
      console.log(`  ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return ok ? 0 : 1;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export { formatBytes };
