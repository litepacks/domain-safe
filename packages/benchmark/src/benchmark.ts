import { buildIndexBuffer, DomainIndex } from "@domain-safe/core";

const SMOKE = process.argv.includes("--smoke");
const DOMAIN_COUNT = SMOKE ? 10_000 : 100_000;
const ITERATIONS = SMOKE ? 10_000 : 1_000_000;

function generateDomains(count: number): string[] {
  const domains: string[] = [];
  for (let i = 0; i < count; i++) {
    domains.push(`bench-${i}.example-block.test`);
  }
  return domains;
}

function bench(name: string, fn: () => void, iterations: number): number {
  // warmup
  for (let i = 0; i < 1000; i++) fn();

  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = Number(process.hrtime.bigint() - start);
  const avgNs = elapsed / iterations;

  console.log(`${name}: ${avgNs.toFixed(0)} ns/op (${iterations.toLocaleString()} ops)`);
  return avgNs;
}

const domains = generateDomains(DOMAIN_COUNT);
console.log(`Building index with ${DOMAIN_COUNT.toLocaleString()} domains...`);

const buildStart = Date.now();
const buffer = buildIndexBuffer({ domains, sources: ["benchmark"], useBloom: true });
const buildMs = Date.now() - buildStart;

console.log(`Build time: ${buildMs}ms`);
console.log(`Index size: ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

const loadStart = Date.now();
const index = DomainIndex.fromBuffer(buffer);
const loadMs = Date.now() - loadStart;
console.log(`Load time (verify checksum): ${loadMs}ms`);

const loadFastStart = Date.now();
DomainIndex.fromBuffer(buffer, { verifyChecksum: false });
const loadFastMs = Date.now() - loadFastStart;
console.log(`Load time (skip checksum):     ${loadFastMs}ms`);

const hitDomain = domains[Math.floor(domains.length / 2)]!;
const missDomain = "safe-not-listed.example.com";

const hitNs = bench("lookup (hit)", () => index.lookup(hitDomain), ITERATIONS);
const missNs = bench("lookup (miss)", () => index.lookup(missDomain), ITERATIONS);
const _suffixNs = bench(
  "lookup (suffix hit)",
  () => index.lookup(`sub.${hitDomain}`),
  ITERATIONS,
);

// Smoke mode thresholds for CI
if (SMOKE) {
  const MAX_LOOKUP_NS = 500_000; // 500µs generous for CI with 10k domains
  if (hitNs > MAX_LOOKUP_NS || missNs > MAX_LOOKUP_NS) {
    console.error(`Benchmark regression: lookup exceeded ${MAX_LOOKUP_NS}ns`);
    process.exit(1);
  }
  if (loadMs > 5000) {
    console.error("Benchmark regression: load time exceeded 5000ms");
    process.exit(1);
  }
}

console.log("\nBenchmark complete.");
