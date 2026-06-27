# Architecture

## Design Principles

1. **CLI/runtime separation** — network access is confined to the CLI layer
2. **Precompiled index** — runtime never parses text; only reads binary format
3. **Immutable index** — lookups hold a reference; reload atomically swaps
4. **Suffix trie** — reverse-label radix trie for DNS blocklist semantics

## Data Flow

```mermaid
flowchart TB
  Config[domain-safe.config.json]
  Sources[@domain-safe/sources]
  CLI[domain-safe update]
  Index[index.bin]
  Core[@domain-safe/core]
  App[Your Application]

  Config --> CLI
  Sources --> CLI
  CLI --> Index
  Index --> Core
  Core --> App
```

## Binary Index Format

See [binary-format.md](binary-format.md).

## Hot Reload

When `domain-safe update` atomically replaces `index.bin`:

1. `fs.watch` detects change (debounced 100ms)
2. New file read; CRC32 skipped by default (`verifyChecksumOnReload: false`)
3. Zero-copy Bloom view + lazy metadata parse
4. New `DomainIndex` built in background
5. `indexRef.current` swapped in single assignment
6. In-flight lookups complete on old index
7. `reload` event emitted

No locks on the lookup path.

## Source Adapters

Each source implements `download()`, `parse()`, `normalize()`, and `metadata()`.
The registry in `@domain-safe/sources` maps config IDs to adapters.

Adding a source: see [adding-sources.md](adding-sources.md).
