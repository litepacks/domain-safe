import { normalizeDomain } from "@domain-safe/core";
import type { DownloadContext, RawEntry, SourceAdapter, SourceMetadata } from "./types.js";

const DOWNLOAD_URL = "https://urlhaus.abuse.ch/downloads/hostfile/";

export class URLHausSource implements SourceAdapter {
  readonly id = "urlhaus";

  metadata(): SourceMetadata {
    return {
      id: this.id,
      name: "URLhaus (abuse.ch)",
      url: DOWNLOAD_URL,
      license: "abuse.ch Terms of Use",
      description: "Malware distribution hostnames from abuse.ch URLhaus host file",
      estimatedDomains: 50_000,
      updateFrequency: "hourly",
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
      throw new Error(`Failed to download URLhaus hostfile: ${response.status} ${response.statusText}`);
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
        let firstSpace = -1;
        for (let i = 0; i < trimmed.length; i++) {
          const char = trimmed[i];
          if (char === " " || char === "\t" || char === "\r") {
            firstSpace = i;
            break;
          }
        }
        let domain = trimmed;
        if (firstSpace !== -1) {
          domain = trimmed.slice(firstSpace).trim();
        }
        if (domain && domain !== "127.0.0.1" && domain !== "0.0.0.0") {
          yield {
            domain,
            source: this.id,
            reason: "malware",
            line: lineNum,
          };
        }
      }
      lineNum++;
    }
  }

  normalize(entry: RawEntry) {
    const domain = normalizeDomain(entry.domain);
    if (!domain) return null;
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(domain)) return null;
    return {
      domain,
      source: entry.source,
      reason: entry.reason,
    };
  }
}

export const urlhaus = new URLHausSource();
