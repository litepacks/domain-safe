export interface IndexMetadata {
  version: number;
  sources: string[];
  buildStats: {
    rawEntries: number;
    uniqueDomains: number;
    durationMs: number;
  };
  reasons?: Record<string, string>;
}

export interface LookupResult {
  listed: boolean;
  domain: string;
  matched?: string;
  source?: string;
  reason?: string;
}

export interface IndexStats {
  domainCount: number;
  databaseSize: number;
  lastUpdate: Date | null;
  sources: string[];
  memoryEstimate: number;
  format: string;
  hasBloom: boolean;
}

export interface DomainIndexLoadOptions {
  /** Verify CRC32 checksum on load. Default: true */
  verifyChecksum?: boolean;
}

export interface DomainSafeLoadOptions {
  dbPath: string;
  autoReload?: boolean;
  watch?: boolean;
  /** Verify CRC32 on initial load. Default: true */
  verifyChecksum?: boolean;
  /** Verify CRC32 on hot reload. Default: false (faster swap) */
  verifyChecksumOnReload?: boolean;
}

export interface ReloadEventPayload {
  success: boolean;
  error?: Error;
  stats?: IndexStats;
}

export type DomainSafeEvents = {
  reload: [ReloadEventPayload];
};
