import { buildBloomFilter } from "./bloom.js";
import {
  FLAG_HAS_BLOOM,
  FORMAT_VERSION,
  HDR,
  HEADER_SIZE,
  MAGIC_BYTES,
} from "./constants.js";
import { crc32 } from "./crc32.js";
import { buildTrieFromDomains } from "./trie-builder.js";
import type { IndexMetadata } from "../types.js";

export interface BuildIndexOptions {
  domains: string[];
  sources: string[];
  reasons?: Record<string, string>;
  useBloom?: boolean;
  buildStats?: IndexMetadata["buildStats"];
}

export function buildIndexBuffer(options: BuildIndexOptions): Uint8Array {
  const { domains, sources, reasons, useBloom = true } = options;
  console.log(`[debug] Sorting ${domains.length.toLocaleString()} domains...`);
  const sortedDomains = [...domains].sort();
  console.log(`[debug] Building trie from sorted domains...`);
  const { trie, stringPool } = buildTrieFromDomains(sortedDomains);

  const meta: IndexMetadata = {
    version: FORMAT_VERSION,
    sources,
    buildStats: options.buildStats ?? {
      rawEntries: domains.length,
      uniqueDomains: sortedDomains.length,
      durationMs: 0,
    },
    ...(reasons && Object.keys(reasons).length > 0 ? { reasons } : {}),
  };

  const metaBytes = new TextEncoder().encode(JSON.stringify(meta));
  let bloomBytes: Uint8Array | null = null;

  if (useBloom && sortedDomains.length > 0) {
    console.log(`[debug] Building Bloom filter for ${sortedDomains.length.toLocaleString()} domains...`);
    bloomBytes = buildBloomFilter(sortedDomains).toBuffer();
  }

  const bloomLength = bloomBytes?.length ?? 0;
  const metaOffset = HEADER_SIZE;
  const bloomOffset = metaOffset + metaBytes.length;
  const trieOffset = bloomOffset + bloomLength;
  const stringPoolOffset = trieOffset + trie.length;
  const totalSize = stringPoolOffset + stringPool.length;

  const buffer = new Uint8Array(totalSize);
  const view = new DataView(buffer.buffer);

  buffer.set(MAGIC_BYTES, HDR.MAGIC);
  view.setUint16(HDR.VERSION, FORMAT_VERSION, true);
  view.setUint16(HDR.FLAGS, bloomBytes ? FLAG_HAS_BLOOM : 0, true);
  view.setUint32(HDR.DOMAIN_COUNT, sortedDomains.length, true);

  const builtAt = BigInt(Date.now());
  view.setUint32(HDR.BUILT_AT_LO, Number(builtAt & 0xffffffffn), true);
  view.setUint32(HDR.BUILT_AT_HI, Number(builtAt >> 32n), true);

  view.setUint32(HDR.META_OFFSET, metaOffset, true);
  view.setUint32(HDR.META_LENGTH, metaBytes.length, true);
  view.setUint32(HDR.BLOOM_OFFSET, bloomBytes ? bloomOffset : 0, true);
  view.setUint32(HDR.BLOOM_LENGTH, bloomLength, true);
  view.setUint32(HDR.TRIE_OFFSET, trieOffset, true);
  view.setUint32(HDR.TRIE_LENGTH, trie.length, true);
  view.setUint32(HDR.STRING_POOL_OFFSET, stringPoolOffset, true);
  view.setUint32(HDR.STRING_POOL_LENGTH, stringPool.length, true);

  buffer.set(metaBytes, metaOffset);
  if (bloomBytes) buffer.set(bloomBytes, bloomOffset);
  buffer.set(trie, trieOffset);
  buffer.set(stringPool, stringPoolOffset);

  const payload = buffer.subarray(HEADER_SIZE);
  view.setUint32(HDR.CHECKSUM, crc32(payload), true);

  return buffer;
}
