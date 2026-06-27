# Binary Index Format

Version 1 (`DSAF` magic)

## Header (64 bytes, little-endian)

| Offset | Size | Field |
|--------|------|-------|
| 0 | 4 | Magic `DSAF` |
| 4 | 2 | Version |
| 6 | 2 | Flags (bit 0: has Bloom) |
| 8 | 4 | Domain count |
| 12 | 4 | Built-at timestamp (low 32 bits) |
| 16 | 4 | Built-at timestamp (high 32 bits) |
| 20 | 4 | CRC32 checksum (payload after header) |
| 24 | 4 | Metadata offset |
| 28 | 4 | Metadata length |
| 32 | 4 | Bloom offset |
| 36 | 4 | Bloom length |
| 40 | 4 | Trie offset |
| 44 | 4 | Trie length |
| 48 | 4 | String pool offset |
| 52 | 4 | String pool length |
| 56 | 8 | Reserved |

## Sections

1. **Metadata** — JSON with sources, build stats, optional reasons map
2. **Bloom filter** — optional fast negative screening
3. **Suffix trie** — flat serialized reverse-label radix trie
4. **String pool** — deduplicated label bytes

## Trie Node Layout

```
[u8 flags: bit0=terminal][u32 childCount][child...]
child: [u32 labelOffset][u8 labelLen][u32 childNodeOffset]
```

## Checksum

CRC32 over all bytes from offset 64 to EOF, stored at offset 20 before final write.
