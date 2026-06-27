export const MAGIC = 0x44494153; // "DSAI" little-endian for "DSAF" bytes D S A F -> actually let's use exact bytes

export const MAGIC_BYTES = new Uint8Array([0x44, 0x53, 0x41, 0x46]); // "DSAF"

export const HEADER_SIZE = 64;
export const FORMAT_VERSION = 1;

export const FLAG_HAS_BLOOM = 1 << 0;

/** Header layout (64 bytes, little-endian) */
export const HDR = {
  MAGIC: 0,
  VERSION: 4,
  FLAGS: 6,
  DOMAIN_COUNT: 8,
  BUILT_AT_LO: 12,
  BUILT_AT_HI: 16,
  CHECKSUM: 20,
  META_OFFSET: 24,
  META_LENGTH: 28,
  BLOOM_OFFSET: 32,
  BLOOM_LENGTH: 36,
  TRIE_OFFSET: 40,
  TRIE_LENGTH: 44,
  STRING_POOL_OFFSET: 48,
  STRING_POOL_LENGTH: 52,
  // bytes 56-63 reserved
} as const;
