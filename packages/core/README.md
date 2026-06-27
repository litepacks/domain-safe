# domain-safe

High-performance Node.js/TypeScript library and CLI for **offline** domain reputation checks using downloadable blacklist sources.

## Features

- **Zero network at runtime** — the library never downloads data; only the CLI does
- **Sub-microsecond lookups** — flat binary suffix trie with optional Bloom filter
- **Lock-free hot reload** — atomic index swap when CLI updates the database
- **Suffix matching** — `evil.com` blocks `sub.evil.com`
- **IDN / punycode** — full normalization support
- **ESM + CJS** — tree-shakeable, TypeScript-first

## Quick Start

```bash
pnpm add domain-safe @domain-safe/core
npx domain-safe init
npx domain-safe update
npx domain-safe check example.com
```

## CLI

| Command | Description |
|---------|-------------|
| `domain-safe init` | Create `.domain-safe/` and `domain-safe.config.json` |
| `domain-safe update` | Download sources, build binary index |
| `domain-safe check <domain>` | Check if domain is listed |
| `domain-safe stats` | Show index statistics |
| `domain-safe doctor` | Validate config, index, and sources |

### Scheduled Updates

Run updates via cron (no built-in daemon):

```cron
0 */6 * * * cd /path/to/project && domain-safe update
```

## Runtime API

```ts
import { DomainSafe } from "@domain-safe/core";

const safe = await DomainSafe.load({
  dbPath: ".domain-safe/index.bin",
  verifyChecksum: true,           // default: validate CRC32 on boot
  verifyChecksumOnReload: false,  // default: skip CRC on hot reload (faster)
});

const result = safe.lookup("sub.example.com");
// { listed: boolean, domain, matched?, source?, reason? }

safe.on("reload", ({ success, stats, error }) => {
  console.log("Index reloaded", success);
});

await safe.reload();
safe.close();
```

## Configuration

```json
{
  "sources": ["fabriziosalmi", "urlhaus", "openphish"],
  "output": ".domain-safe",
  "format": "binary",
  "compression": true,
  "runtime": {
    "autoReload": true,
    "watch": true
  }
}
```

### Available sources

| ID | Description |
|----|-------------|
| `fabriziosalmi` | Aggregated daily domain blacklist (~3M domains) |
| `urlhaus` | abuse.ch URLhaus malware hostnames |
| `openphish` | OpenPhish community phishing feed (domains extracted from URLs) |

Use any combination in `sources`. All configured feeds are merged and deduplicated at build time.

## Architecture

```
CLI (network)  →  download + parse + normalize  →  index.bin
Runtime (offline)  →  load binary index  →  lookup()
```

See [docs/architecture.md](docs/architecture.md) for details.

## Packages

| Package | Description |
|---------|-------------|
| `@domain-safe/core` | Runtime library (zero deps) |
| `@domain-safe/sources` | Source adapters (CLI only) |
| `domain-safe` | CLI binary |
| `@domain-safe/benchmark` | Performance benchmarks |
| `@domain-safe/examples` | Express, Hono, Fastify, Worker examples |

## Benchmarks

Measured with `@domain-safe/benchmark` on Node.js 20, synthetic domains, Bloom filter enabled.

### Lookup (100K domains, warm cache)

| Operation | Latency | Notes |
|-----------|---------|-------|
| **lookup (miss)** | **~892 ns/op** | Bloom filter short-circuits most negatives |
| **lookup (hit)** | **~8 µs/op** | Suffix trie traversal + binary search on children |
| **lookup (suffix hit)** | **~7 µs/op** | e.g. `sub.evil.com` matches listed `evil.com` |

### Index build & load

| Metric | 100K domains | Notes |
|--------|--------------|-------|
| Index build (CLI) | ~15 s | download excluded; parse + dedupe + binary encode |
| Index size | ~2.5 MB | flat suffix trie + Bloom + string pool |
| Load time (runtime, verify) | ~13 ms | read + CRC32 + zero-copy Bloom view |
| Load time (skip checksum) | ~5–8 ms | `verifyChecksum: false` or hot reload default |
| Large fixture test | 100K domains | covered in CI integration tests |

### Load optimizations

Runtime load is optimized for large indexes:

| Optimization | Effect |
|--------------|--------|
| **Zero-copy Bloom** | Bloom filter is a view into `index.bin` — no duplicate buffer |
| **Lazy metadata** | JSON metadata parsed only when `stats()` or `reason` is needed |
| **Optional checksum** | Skip CRC32 on hot reload (`verifyChecksumOnReload: false`, default) |

```ts
// Fastest startup when index is trusted (e.g. CI-built artifact)
const safe = await DomainSafe.load({
  dbPath: ".domain-safe/index.bin",
  verifyChecksum: false,
});

// Production: verify on boot, fast reload thereafter (default behavior)
const prod = await DomainSafe.load({
  dbPath: ".domain-safe/index.bin",
  verifyChecksum: true,
  verifyChecksumOnReload: false,
});
```

### Run locally

```bash
pnpm build
pnpm benchmark              # full run: 100K domains, 1M iterations
pnpm benchmark -- --smoke   # CI smoke: 10K domains, regression guard
```

Smoke mode fails CI if lookup exceeds 500 µs/op or load exceeds 5 s.

### Design notes

- **Miss path is fastest** — Bloom filter rejects domains not in the index without trie traversal
- **Hit path scales with label depth** — suffix match walks reverse labels (`com` → `evil` → …)
- **No runtime allocations** on the lookup hot path — flat `ArrayBuffer` + in-place reads
- **Millions of domains** — index build time grows linearly; load stays under ~100 ms target for ~3M entries (see [docs/architecture.md](docs/architecture.md))

Numbers vary by CPU, Node version, and real-world domain distribution. Treat as indicative, not a SLA.

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm benchmark -- --smoke
```

## Alternatives

domain-safe is an **in-process, offline-first** domain blocklist library. Depending on your use case, these alternatives may fit better:

| Tool | Type | Best for |
|------|------|----------|
| **[Pi-hole](https://pi-hole.net/)** | DNS sinkhole | Network-wide blocking for all devices on a LAN |
| **[AdGuard Home](https://adguard.com/adguard-home/overview.html)** | DNS sinkhole | Home network filtering with a web UI |
| **[dnsink](https://github.com/kakarot-dev/dnsink)** | DNS proxy (Rust) | High-performance DNS-layer blocking with live feeds |
| **[agent-dns-firewall](https://github.com/johnzilla/agent-dns-firewall)** | In-process Node.js library | AI agents / apps that need runtime fetch + blocklist refresh |
| **[@gorhill/ubo-core](https://www.npmjs.com/package/@gorhill/ubo-core)** | In-process trie engine | uBlock Origin-style filter lists and hostname matching |
| **[fabriziosalmi/blacklists](https://github.com/fabriziosalmi/blacklists)** | Raw blocklist feeds | Pi-hole, Unbound, BIND — use lists directly without a library |
| **[Google Safe Browsing API](https://developers.google.com/safe-browsing)** | Hosted API | Real-time URL/domain reputation with Google infrastructure |
| **[VirusTotal API](https://developers.virustotal.com/)** | Hosted API | Multi-vendor threat intelligence and enrichment |

### When to choose domain-safe

- You need **zero network access at runtime** (air-gapped, edge, strict security)
- You want **microsecond in-memory lookups** inside Node.js/Bun/Deno
- You need **hot reload** without restarting your app
- You prefer a **CLI build step + binary index** over parsing text on every startup

### When to choose something else

- **Network-wide protection** → Pi-hole, AdGuard Home, or dnsink at the DNS layer
- **Runtime auto-download + refresh** → agent-dns-firewall
- **Full filter-list syntax** (EasyList, uBlock rules) → @gorhill/ubo-core
- **Real-time cloud reputation + scoring** → Safe Browsing, VirusTotal, or similar APIs
- **Simple hosts-file blocking** → download [fabriziosalmi/blacklists](https://github.com/fabriziosalmi/blacklists) and point your resolver at it

## License

MIT
