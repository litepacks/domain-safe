import { normalizeDomain } from "@domain-safe/core";
import type { DownloadContext, RawEntry, SourceAdapter, SourceMetadata } from "./types.js";

const DOWNLOAD_URL =
  "https://github.com/fabriziosalmi/blacklists/releases/download/latest/blacklist.txt";

export class FabrizioSalmiSource implements SourceAdapter {
  readonly id = "fabriziosalmi";

  metadata(): SourceMetadata {
    return {
      id: this.id,
      name: "Fabrizio Salmi Blacklists",
      url: DOWNLOAD_URL,
      license: "Various (aggregated public lists)",
      description:
        "Daily updated aggregated domain blacklist from fabriziosalmi/blacklists",
      estimatedDomains: 3_000_000,
      updateFrequency: "daily",
    };
  }

  async download(ctx: DownloadContext = {}): Promise<Uint8Array> {
    const response = await fetch(DOWNLOAD_URL, {
      signal: ctx.signal,
      headers: {
        "User-Agent": ctx.userAgent ?? "domain-safe/0.1.0",
        Accept: "text/plain",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to download fabriziosalmi blacklist: ${response.status} ${response.statusText}`,
      );
    }

    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  *parse(raw: Uint8Array): Generator<RawEntry, void, unknown> {
    const text = new TextDecoder().decode(raw);
    let start = 0;
    let lineNum = 1;
    while (start < text.length) {
      let end = text.indexOf("\n", start);
      if (end === -1) {
        end = text.length;
      }
      const line = text.slice(start, end);
      start = end + 1;

      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        lineNum++;
        continue;
      }

      const match = trimmed.match(/^\S+/);
      const domainRaw = match ? match[0]! : "";
      const domain = domainRaw.replace(/^local=:/, "");
      if (domain) {
        yield {
          domain,
          source: this.id,
          line: lineNum,
        };
      }
      lineNum++;
    }
  }

  normalize(entry: RawEntry) {
    const domain = normalizeDomain(entry.domain);
    if (!domain) return null;
    return {
      domain,
      source: entry.source,
      reason: entry.reason,
    };
  }
}

export const fabriziosalmi = new FabrizioSalmiSource();
