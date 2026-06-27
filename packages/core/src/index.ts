export { DomainSafe } from "./domain-safe.js";
export { normalizeDomain, reverseLabels } from "./normalizer.js";
export type { NormalizeOptions } from "./normalizer.js";
export {
  DomainSafeError,
  CorruptIndexError,
  ConfigError,
  IndexNotFoundError,
} from "./errors.js";
export type {
  DomainSafeLoadOptions,
  DomainIndexLoadOptions,
  DomainSafeEvents,
  IndexMetadata,
  IndexStats,
  LookupResult,
  ReloadEventPayload,
} from "./types.js";
export { buildIndexBuffer } from "./binary/builder.js";
export type { BuildIndexOptions } from "./binary/builder.js";
export { DomainIndex, parseIndex } from "./binary/reader.js";
export { buildTrieFromDomains } from "./binary/trie-builder.js";
export { BloomFilter, buildBloomFilter } from "./binary/bloom.js";
export { crc32 } from "./binary/crc32.js";
export { MAGIC_BYTES, HEADER_SIZE, FORMAT_VERSION, HDR } from "./binary/constants.js";
