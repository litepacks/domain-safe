import type { SourceAdapter } from "./types.js";
import { fabriziosalmi } from "./fabriziosalmi.js";
import { urlhaus } from "./urlhaus.js";
import { openphish } from "./openphish.js";

/** Stub adapters for future implementation */
export const stubSources = ["phishtank", "spamhaus", "hagezi", "oisd"] as const;

export type StubSourceId = (typeof stubSources)[number];

const registry = new Map<string, SourceAdapter>([
  [fabriziosalmi.id, fabriziosalmi],
  [urlhaus.id, urlhaus],
  [openphish.id, openphish],
]);

export function getSource(id: string): SourceAdapter {
  const source = registry.get(id);
  if (!source) {
    const available = [...registry.keys(), ...stubSources].join(", ");
    throw new Error(`Unknown source "${id}". Available: ${available}`);
  }
  return source;
}

export function listSources(): SourceAdapter[] {
  return [...registry.values()];
}

export function registerSource(source: SourceAdapter): void {
  registry.set(source.id, source);
}

export { fabriziosalmi, urlhaus, openphish };
