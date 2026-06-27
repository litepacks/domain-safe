import { normalizeDomain } from "@domain-safe/core";
import type { DownloadContext, RawEntry, SourceAdapter, SourceMetadata } from "./types.js";

const DOWNLOAD_URL = "https://openphish.com/feed.txt";

export class OpenPhishSource implements SourceAdapter {
  readonly id = "openphish";

  metadata(): SourceMetadata {
    return {
      id: this.id,
      name: "OpenPhish Community Feed",
      url: DOWNLOAD_URL,
      license: "OpenPhish Terms (non-commercial community feed)",
      description: "Active phishing URLs from OpenPhish community feed (domains extracted at build time)",
      estimatedDomains: 5_000,
      updateFrequency: "12 hours",
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
        `Failed to download OpenPhish feed: ${response.status} ${response.statusText}`,
      );
    }

    return new Uint8Array(await response.arrayBuffer());
  }

  parse(raw: Uint8Array): RawEntry[] {
    const text = new TextDecoder().decode(raw);
    const entries: RawEntry[] = [];

    for (const [index, line] of text.split("\n").entries()) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      entries.push({
        domain: trimmed,
        source: this.id,
        reason: "phishing",
        line: index + 1,
      });
    }

    return entries;
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

export const openphish = new OpenPhishSource();
