/**
 * Cloudflare Worker pattern for domain-safe
 *
 * Workers cannot read local filesystem. Pre-build the index with CLI:
 *   domain-safe update
 *
 * Upload index.bin to R2/KV, then load at worker startup:
 */

import { DomainIndex } from "@domain-safe/core";

export interface Env {
  INDEX: KVNamespace; // or R2 bucket binding
}

let index: DomainIndex | null = null;

export async function loadIndexFromKV(env: Env): Promise<DomainIndex> {
  const data = await env.INDEX.get("index.bin", "arrayBuffer");
  if (!data) {
    throw new Error("Index not found in KV. Upload index.bin first.");
  }
  index = DomainIndex.fromBuffer(new Uint8Array(data));
  return index;
}

export function lookupDomain(domain: string): { listed: boolean; matched?: string } {
  if (!index) {
    throw new Error("Index not loaded. Call loadIndexFromKV() in fetch handler.");
  }
  const matched = index.lookup(domain.toLowerCase());
  return matched ? { listed: true, matched } : { listed: false };
}

// Example worker fetch handler:
// export default {
//   async fetch(request: Request, env: Env) {
//     if (!index) await loadIndexFromKV(env);
//     const url = new URL(request.url);
//     const result = lookupDomain(url.hostname);
//     if (result.listed) return new Response("Blocked", { status: 403 });
//     return fetch(request);
//   },
// };
