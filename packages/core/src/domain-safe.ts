import { watch, type FSWatcher } from "node:fs";
import { readFile } from "node:fs/promises";
import { EventEmitter } from "node:events";
import { DomainIndex } from "./binary/reader.js";
import { IndexNotFoundError } from "./errors.js";
import { normalizeDomain } from "./normalizer.js";
import type {
  DomainSafeEvents,
  DomainSafeLoadOptions,
  DomainIndexLoadOptions,
  IndexStats,
  LookupResult,
  ReloadEventPayload,
} from "./types.js";

export class DomainSafe extends EventEmitter {
  private indexRef: { current: DomainIndex | null };
  private readonly dbPath: string;
  private readonly autoReload: boolean;
  private readonly watchEnabled: boolean;
  private readonly verifyChecksumOnReload: boolean;
  private watcher: FSWatcher | null = null;
  private reloadInProgress = false;
  private reloadDebounce: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  private constructor(
    index: DomainIndex,
    dbPath: string,
    options: Required<
      Pick<DomainSafeLoadOptions, "autoReload" | "watch" | "verifyChecksum" | "verifyChecksumOnReload">
    >,
  ) {
    super();
    this.indexRef = { current: index };
    this.dbPath = dbPath;
    this.autoReload = options.autoReload;
    this.watchEnabled = options.watch;
    this.verifyChecksumOnReload = options.verifyChecksumOnReload;
  }

  static async load(options: DomainSafeLoadOptions): Promise<DomainSafe> {
    const resolved = {
      autoReload: options.autoReload ?? true,
      watch: options.watch ?? true,
      verifyChecksum: options.verifyChecksum ?? true,
      verifyChecksumOnReload: options.verifyChecksumOnReload ?? false,
    };

    const index = await DomainSafe.readIndexFromDisk(options.dbPath, {
      verifyChecksum: resolved.verifyChecksum,
    });

    const instance = new DomainSafe(index, options.dbPath, resolved);

    if (instance.autoReload && instance.watchEnabled) {
      instance.startWatching();
    }

    return instance;
  }

  static async readIndexFromDisk(
    dbPath: string,
    loadOptions: DomainIndexLoadOptions = {},
  ): Promise<DomainIndex> {
    let buffer: Buffer;
    try {
      buffer = await readFile(dbPath);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        throw new IndexNotFoundError(dbPath);
      }
      throw err;
    }
    return DomainIndex.fromBuffer(buffer, loadOptions);
  }

  private startWatching(): void {
    if (this.watcher || this.closed) return;

    try {
      this.watcher = watch(this.dbPath, () => {
        if (this.reloadDebounce) clearTimeout(this.reloadDebounce);
        this.reloadDebounce = setTimeout(() => {
          void this.reload();
        }, 100);
      });
    } catch {
      // watch may fail on some platforms; autoReload still works manually
    }
  }

  lookup(domain: string): LookupResult {
    const normalized = normalizeDomain(domain);
    if (!normalized) {
      return { listed: false, domain };
    }

    const index = this.indexRef.current;
    if (!index) {
      return { listed: false, domain: normalized };
    }

    const matched = index.lookup(normalized);
    if (!matched) {
      return { listed: false, domain: normalized };
    }

    const reason = index.metadata.reasons?.[matched];
    return {
      listed: true,
      domain: normalized,
      matched,
      source: index.metadata.sources[0],
      reason,
    };
  }

  batchLookup(domains: string[]): LookupResult[] {
    return domains.map((d) => this.lookup(d));
  }

  stats(): IndexStats {
    const index = this.indexRef.current;
    if (!index) {
      return {
        domainCount: 0,
        databaseSize: 0,
        lastUpdate: null,
        sources: [],
        memoryEstimate: 0,
        format: "binary",
        hasBloom: false,
      };
    }

    return {
      domainCount: index.domainCount,
      databaseSize: index.buffer.byteLength,
      lastUpdate: index.builtAt,
      sources: index.metadata.sources,
      memoryEstimate: index.estimateMemory(),
      format: "binary",
      hasBloom: index.hasBloom,
    };
  }

  async reload(): Promise<void> {
    if (this.reloadInProgress || this.closed) return;
    this.reloadInProgress = true;

    try {
      const newIndex = await DomainSafe.readIndexFromDisk(this.dbPath, {
        verifyChecksum: this.verifyChecksumOnReload,
      });
      this.indexRef.current = newIndex;
      const payload: ReloadEventPayload = { success: true, stats: this.stats() };
      this.emit("reload", payload);
    } catch (err) {
      const payload: ReloadEventPayload = {
        success: false,
        error: err instanceof Error ? err : new Error(String(err)),
      };
      this.emit("reload", payload);
      throw err;
    } finally {
      this.reloadInProgress = false;
    }
  }

  on<K extends keyof DomainSafeEvents>(
    event: K,
    listener: (...args: DomainSafeEvents[K]) => void,
  ): this {
    return super.on(event, listener);
  }

  close(): void {
    this.closed = true;
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.reloadDebounce) {
      clearTimeout(this.reloadDebounce);
      this.reloadDebounce = null;
    }
  }
}
