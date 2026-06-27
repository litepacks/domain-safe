import { Hono } from "hono";
import { DomainSafe } from "@domain-safe/core";

let safe: DomainSafe | null = null;

export async function initDomainSafe(dbPath = ".domain-safe/index.bin"): Promise<void> {
  safe = await DomainSafe.load({ dbPath, autoReload: true, watch: true });
}

export function createDomainSafeMiddleware() {
  return async (c: { req: { header: (name: string) => string | undefined } }, next: () => Promise<void>) => {
    if (!safe) {
      throw new Error("DomainSafe not initialized");
    }

    const host = c.req.header("host")?.split(":")[0] ?? "";
    const result = safe.lookup(host);

    if (result.listed) {
      return Response.json(
        { error: "Domain blocked", domain: result.domain, matched: result.matched },
        { status: 403 },
      );
    }

    await next();
  };
}

// Usage:
// const app = new Hono();
// await initDomainSafe();
// app.use("*", createDomainSafeMiddleware());

export { Hono };
