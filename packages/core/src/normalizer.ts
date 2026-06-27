import punycode from "node:punycode";

const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const MAX_DOMAIN_LENGTH = 253;

export interface NormalizeOptions {
  stripWww?: boolean;
}

/**
 * Normalize a domain for lookup and indexing.
 * Returns null if the input is not a valid domain.
 */
export function normalizeDomain(input: string, options: NormalizeOptions = {}): string | null {
  if (!input || typeof input !== "string") {
    return null;
  }

  let domain = input.trim().toLowerCase();

  if (domain.endsWith(".")) {
    domain = domain.slice(0, -1);
  }

  if (domain.length === 0 || domain.length > MAX_DOMAIN_LENGTH) {
    return null;
  }

  // Strip URL-like prefixes if accidentally passed
  if (domain.includes("://")) {
    try {
      domain = new URL(domain).hostname;
    } catch {
      return null;
    }
  }

  // Strip port if present
  const colonIdx = domain.lastIndexOf(":");
  if (colonIdx > domain.lastIndexOf("]")) {
    domain = domain.slice(0, colonIdx);
  }

  // Convert IDN to punycode per label
  domain = domain
    .split(".")
    .map((label) => {
      if (label.startsWith("xn--")) {
        return label;
      }
      try {
        return punycode.toASCII(label);
      } catch {
        return label;
      }
    })
    .join(".");

  if (options.stripWww && domain.startsWith("www.")) {
    domain = domain.slice(4);
  }

  const labels = domain.split(".");
  if (labels.length < 2) {
    return null;
  }

  for (const label of labels) {
    if (!label || label.length > 63 || !DOMAIN_LABEL.test(label)) {
      return null;
    }
  }

  return domain;
}

/**
 * Split domain into labels from right to left (suffix order).
 */
export function reverseLabels(domain: string): string[] {
  return domain.split(".").reverse();
}
