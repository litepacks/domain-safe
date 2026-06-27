import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { DomainSafe } from "@domain-safe/core";

const domainSafePluginImpl: FastifyPluginAsync<{ dbPath?: string }> = async (
  fastify,
  opts,
) => {
  const safe = await DomainSafe.load({
    dbPath: opts.dbPath ?? ".domain-safe/index.bin",
    autoReload: true,
    watch: true,
  });

  fastify.addHook("onRequest", async (request, reply) => {
    const result = safe.lookup(request.hostname);

    if (result.listed) {
      return reply.status(403).send({
        error: "Domain blocked",
        domain: result.domain,
        matched: result.matched,
      });
    }
  });

  fastify.addHook("onClose", async () => {
    safe.close();
  });
};

export const domainSafePlugin: FastifyPluginAsync<{ dbPath?: string }> =
  domainSafePluginImpl;

// Usage:
// await fastify.register(domainSafePlugin, { dbPath: ".domain-safe/index.bin" });

export type { FastifyInstance };
