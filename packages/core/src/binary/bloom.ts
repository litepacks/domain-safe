import { crc32 } from "./crc32.js";

/** Simple Bloom filter for fast negative screening */
export class BloomFilter {
  readonly bits: Uint8Array;
  private readonly hashCount: number;

  constructor(
    public readonly bitCount: number,
    hashCount = 7,
    bits?: Uint8Array,
  ) {
    this.hashCount = hashCount;
    this.bits = bits ?? new Uint8Array(Math.ceil(bitCount / 8));
  }

  /** Zero-copy view into an existing index buffer */
  static fromView(bits: Uint8Array, bitCount: number, hashCount = 7): BloomFilter {
    return new BloomFilter(bitCount, hashCount, bits);
  }

  /** @deprecated Prefer fromView for runtime loads — copies the buffer */
  static fromBuffer(buffer: Uint8Array, bitCount: number, hashCount = 7): BloomFilter {
    const filter = new BloomFilter(bitCount, hashCount);
    filter.bits.set(buffer.subarray(0, filter.bits.length));
    return filter;
  }

  add(key: string): void {
    let h1 = 0x811c9dc5;
    let h2 = 0;
    for (let i = 0; i < key.length; i++) {
      const c = key.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193);
      h2 = Math.imul(h2 ^ c, 0x01000193);
    }
    h1 = h1 >>> 0;
    h2 = h2 >>> 0;

    for (let i = 0; i < this.hashCount; i++) {
      const idx = Math.abs((h1 + i * h2) % this.bitCount);
      this.bits[idx >> 3]! |= 1 << (idx & 7);
    }
  }

  mightContain(key: string): boolean {
    let h1 = 0x811c9dc5;
    let h2 = 0;
    for (let i = 0; i < key.length; i++) {
      const c = key.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193);
      h2 = Math.imul(h2 ^ c, 0x01000193);
    }
    h1 = h1 >>> 0;
    h2 = h2 >>> 0;

    for (let i = 0; i < this.hashCount; i++) {
      const idx = Math.abs((h1 + i * h2) % this.bitCount);
      if ((this.bits[idx >> 3]! & (1 << (idx & 7))) === 0) {
        return false;
      }
    }
    return true;
  }

  toBuffer(): Uint8Array {
    return this.bits;
  }

  /** Check all suffixes of a domain (reverse label walk) */
  mightContainSuffix(domain: string): boolean {
    if (this.mightContain(domain)) {
      return true;
    }
    let index = -1;
    while ((index = domain.indexOf(".", index + 1)) !== -1) {
      if (this.mightContain(domain.slice(index + 1))) {
        return true;
      }
    }
    return false;
  }
}

export function optimalBloomSize(itemCount: number, errorRate = 0.001): number {
  const m = Math.ceil(-((itemCount * Math.log(errorRate)) / Math.log(2) ** 2));
  return Math.max(1024, Math.ceil(m / 8) * 8);
}

export function buildBloomFilter(domains: string[]): BloomFilter {
  const bitCount = optimalBloomSize(domains.length);
  const filter = new BloomFilter(bitCount);
  for (const domain of domains) {
    filter.add(domain);
    let index = -1;
    while ((index = domain.indexOf(".", index + 1)) !== -1) {
      filter.add(domain.slice(index + 1));
    }
  }
  return filter;
}

export { crc32 };
