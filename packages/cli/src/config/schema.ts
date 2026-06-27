import { z } from "zod";

export const configSchema = z.object({
  sources: z.array(z.string()).min(1, "At least one source is required"),
  output: z.string().default(".domain-safe"),
  format: z.enum(["binary"]).default("binary"),
  compression: z.boolean().default(true),
  runtime: z
    .object({
      autoReload: z.boolean().default(true),
      watch: z.boolean().default(true),
    })
    .default({ autoReload: true, watch: true }),
});

export type DomainSafeConfig = z.infer<typeof configSchema>;

export const DEFAULT_CONFIG: DomainSafeConfig = {
  sources: ["fabriziosalmi"],
  output: ".domain-safe",
  format: "binary",
  compression: true,
  runtime: {
    autoReload: true,
    watch: true,
  },
};

export function getIndexPath(config: DomainSafeConfig): string {
  return `${config.output}/index.bin`;
}
