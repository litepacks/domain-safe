import type { Request, Response, NextFunction } from "express";
import { DomainSafe } from "@domain-safe/core";

let safe: DomainSafe | null = null;

export async function initDomainSafe(dbPath = ".domain-safe/index.bin"): Promise<void> {
  safe = await DomainSafe.load({ dbPath, autoReload: true, watch: true });
}

export function domainSafeMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!safe) {
      return next(new Error("DomainSafe not initialized. Call initDomainSafe() first."));
    }

    const hostname = req.hostname;
    const result = safe.lookup(hostname);

    if (result.listed) {
      return res.status(403).json({
        error: "Domain blocked",
        domain: result.domain,
        matched: result.matched,
        source: result.source,
      });
    }

    next();
  };
}

// Usage:
// await initDomainSafe();
// app.use(domainSafeMiddleware());
