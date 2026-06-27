export class DomainSafeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "DomainSafeError";
  }
}

export class CorruptIndexError extends DomainSafeError {
  constructor(message: string) {
    super(message, "CORRUPT_INDEX");
    this.name = "CorruptIndexError";
  }
}

export class ConfigError extends DomainSafeError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR");
    this.name = "ConfigError";
  }
}

export class IndexNotFoundError extends DomainSafeError {
  constructor(path: string) {
    super(`Index file not found: ${path}`, "INDEX_NOT_FOUND");
    this.name = "IndexNotFoundError";
  }
}
