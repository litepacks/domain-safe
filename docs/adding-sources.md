# Adding Sources

## 1. Create adapter

```ts
// packages/sources/src/my-source.ts
import { normalizeDomain } from "@domain-safe/core";
import type { SourceAdapter, RawEntry } from "./types.js";

export class MySource implements SourceAdapter {
  readonly id = "mysource";

  metadata() {
    return {
      id: this.id,
      name: "My Source",
      url: "https://example.com/list.txt",
      license: "MIT",
      description: "...",
    };
  }

  async download(ctx) {
    const res = await fetch(this.metadata().url, { signal: ctx?.signal });
    return new Uint8Array(await res.arrayBuffer());
  }

  parse(raw: Uint8Array): RawEntry[] {
    // return { domain, source, reason? }
  }

  normalize(entry: RawEntry) {
    const domain = normalizeDomain(entry.domain);
    if (!domain) return null;
    return { domain, source: entry.source, reason: entry.reason };
  }
}
```

## 2. Register

```ts
// packages/sources/src/registry.ts
import { mySource } from "./my-source.js";
registry.set(mySource.id, mySource);
```

## 3. Enable in config

```json
{
  "sources": ["fabriziosalmi", "mysource"]
}
```

## Built-in Sources

| ID | Provider | Format |
|----|----------|--------|
| `fabriziosalmi` | [fabriziosalmi/blacklists](https://github.com/fabriziosalmi/blacklists) | Plain domain list |
| `urlhaus` | [abuse.ch URLhaus](https://urlhaus.abuse.ch/) | Hosts file |
| `openphish` | [OpenPhish](https://openphish.com/) | Phishing URLs (domains extracted) |

Example multi-source config:

```json
{
  "sources": ["fabriziosalmi", "urlhaus", "openphish"]
}
```

## Planned Sources

- PhishTank
- Spamhaus
- HaGeZi
- OISD

Stubs are listed in `stubSources` until implemented.
