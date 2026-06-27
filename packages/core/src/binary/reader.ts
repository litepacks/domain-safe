import { BloomFilter } from "./bloom.js";
import {
  FLAG_HAS_BLOOM,
  HDR,
  HEADER_SIZE,
  MAGIC_BYTES,
} from "./constants.js";
import { crc32 } from "./crc32.js";
import { CorruptIndexError } from "../errors.js";
import type { IndexMetadata, DomainIndexLoadOptions } from "../types.js";

export class DomainIndex {
  readonly buffer: Uint8Array;
  readonly view: DataView;
  readonly domainCount: number;
  readonly builtAt: Date;
  readonly hasBloom: boolean;
  readonly bloom: BloomFilter | null;
  readonly trieOffset: number;
  readonly stringPoolOffset: number;
  readonly stringPoolLength: number;

  private readonly metaOffset: number;
  private readonly metaLength: number;
  private _metadata: IndexMetadata | null = null;

  constructor(buffer: Uint8Array, options: DomainIndexLoadOptions = {}) {
    const verifyChecksum = options.verifyChecksum ?? true;

    if (buffer.length < HEADER_SIZE) {
      throw new CorruptIndexError("Index file too small");
    }

    for (let i = 0; i < 4; i++) {
      if (buffer[i] !== MAGIC_BYTES[i]) {
        throw new CorruptIndexError("Invalid index magic bytes");
      }
    }

    this.buffer = buffer;
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    if (verifyChecksum) {
      const storedChecksum = this.view.getUint32(HDR.CHECKSUM, true);
      const payload = buffer.subarray(HEADER_SIZE);
      const computed = crc32(payload);
      if (storedChecksum !== computed) {
        throw new CorruptIndexError(
          `Checksum mismatch: expected ${storedChecksum}, got ${computed}`,
        );
      }
    }

    const version = this.view.getUint16(HDR.VERSION, true);
    if (version !== 1) {
      throw new CorruptIndexError(`Unsupported index version: ${version}`);
    }

    const flags = this.view.getUint16(HDR.FLAGS, true);
    this.hasBloom = (flags & FLAG_HAS_BLOOM) !== 0;
    this.domainCount = this.view.getUint32(HDR.DOMAIN_COUNT, true);

    const builtAtLo = BigInt(this.view.getUint32(HDR.BUILT_AT_LO, true));
    const builtAtHi = BigInt(this.view.getUint32(HDR.BUILT_AT_HI, true));
    this.builtAt = new Date(Number((builtAtHi << 32n) | builtAtLo));

    this.metaOffset = this.view.getUint32(HDR.META_OFFSET, true);
    this.metaLength = this.view.getUint32(HDR.META_LENGTH, true);

    const bloomOffset = this.view.getUint32(HDR.BLOOM_OFFSET, true);
    const bloomLength = this.view.getUint32(HDR.BLOOM_LENGTH, true);
    this.trieOffset = this.view.getUint32(HDR.TRIE_OFFSET, true);
    this.stringPoolOffset = this.view.getUint32(HDR.STRING_POOL_OFFSET, true);
    this.stringPoolLength = this.view.getUint32(HDR.STRING_POOL_LENGTH, true);

    if (this.hasBloom && bloomLength > 0) {
      const bloomData = buffer.subarray(bloomOffset, bloomOffset + bloomLength);
      this.bloom = BloomFilter.fromView(bloomData, bloomLength * 8);
    } else {
      this.bloom = null;
    }
  }

  /** Lazily parsed metadata — not loaded until first access */
  get metadata(): IndexMetadata {
    if (!this._metadata) {
      const metaJson = new TextDecoder().decode(
        this.buffer.subarray(this.metaOffset, this.metaOffset + this.metaLength),
      );
      this._metadata = JSON.parse(metaJson) as IndexMetadata;
    }
    return this._metadata;
  }

  static fromBuffer(
    buffer: ArrayBuffer | Uint8Array,
    options?: DomainIndexLoadOptions,
  ): DomainIndex {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    return new DomainIndex(bytes, options);
  }

  readLabel(labelOffset: number, labelLen: number): string {
    const start = this.stringPoolOffset + labelOffset;
    return new TextDecoder().decode(
      this.buffer.subarray(start, start + labelLen),
    );
  }

  /** Suffix trie lookup — returns matched blocked domain or null */
  lookup(normalizedDomain: string): string | null {
    if (this.bloom && !this.bloom.mightContainSuffix(normalizedDomain)) {
      return null;
    }

    const labels = normalizedDomain.split(".").reverse();
    let nodeRelOffset = 0;
    let matched: string | null = null;
    let depth = 0;

    for (; depth < labels.length; depth++) {
      const label = labels[depth]!;
      const nodeOffset = this.trieOffset + nodeRelOffset;
      const childCount = this.view.getUint32(nodeOffset + 1, true);

      let found = false;
      const childOff = nodeOffset + 5;
      let lo = 0;
      let hi = childCount - 1;

      while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        const entryOff = childOff + mid * 9;
        const labelLen = this.view.getUint8(entryOff + 4);

        if (labelLen !== label.length) {
          const labelOffset = this.view.getUint32(entryOff, true);
          const stored = this.readLabel(labelOffset, labelLen);
          const cmp = stored.localeCompare(label);
          if (cmp < 0) lo = mid + 1;
          else hi = mid - 1;
          continue;
        }

        const labelOffset = this.view.getUint32(entryOff, true);
        const stored = this.readLabel(labelOffset, labelLen);
        const cmp = stored.localeCompare(label);
        if (cmp === 0) {
          nodeRelOffset = this.view.getUint32(entryOff + 5, true);
          found = true;
          break;
        }
        if (cmp < 0) lo = mid + 1;
        else hi = mid - 1;
      }

      if (!found) break;

      const matchedNodeOffset = this.trieOffset + nodeRelOffset;
      if (this.view.getUint8(matchedNodeOffset) === 1) {
        matched = labels
          .slice(0, depth + 1)
          .reverse()
          .join(".");
      }
    }

    return matched;
  }

  estimateMemory(): number {
    return this.buffer.byteLength;
  }
}

export function parseIndex(
  buffer: ArrayBuffer | Uint8Array,
  options?: DomainIndexLoadOptions,
): DomainIndex {
  return DomainIndex.fromBuffer(buffer, options);
}
