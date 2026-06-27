export interface SourceMetadata {
  id: string;
  name: string;
  url: string;
  license: string;
  description: string;
  estimatedDomains?: number;
  updateFrequency?: string;
}

export interface RawEntry {
  domain: string;
  source: string;
  reason?: string;
  line?: number;
}

export interface NormalizedEntry {
  domain: string;
  source: string;
  reason?: string;
}

export interface DownloadContext {
  signal?: AbortSignal;
  userAgent?: string;
}

export interface SourceAdapter {
  readonly id: string;
  metadata(): SourceMetadata;
  download(ctx?: DownloadContext): Promise<Uint8Array>;
  parse(raw: Uint8Array): Iterable<RawEntry>;
  normalize(entry: RawEntry): NormalizedEntry | null;
}
