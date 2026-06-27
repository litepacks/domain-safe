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
      if (trimmed && !trimmed.startsWith("#")) {
        yield {
          domain: trimmed,
          source: this.id,
          reason: "phishing",
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

export const openphish = new OpenPhishSource();
