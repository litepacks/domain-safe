import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { resolve } from "node:path";
import { cwd } from "node:process";
import {
  configSchema,
  DEFAULT_CONFIG,
  getIndexPath,
  type DomainSafeConfig,
} from "./schema.js";

const CONFIG_FILENAME = "domain-safe.config.json";

export function getConfigPath(baseDir = cwd()): string {
  return resolve(baseDir, CONFIG_FILENAME);
}

export async function loadConfig(baseDir = cwd()): Promise<DomainSafeConfig> {
  const configPath = getConfigPath(baseDir);
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return configSchema.parse(parsed);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(
        `Configuration not found. Run \`domain-safe init\` to create ${CONFIG_FILENAME}`,
      );
    }
    throw err;
  }
}

export async function writeConfig(
  config: DomainSafeConfig,
  baseDir = cwd(),
): Promise<void> {
  const configPath = getConfigPath(baseDir);
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export async function initProject(baseDir = cwd()): Promise<void> {
  const configPath = getConfigPath(baseDir);
  const config = DEFAULT_CONFIG;

  try {
    await access(configPath);
    throw new Error(`${CONFIG_FILENAME} already exists`);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw err;
  }

  await mkdir(resolve(baseDir, config.output), { recursive: true });
  await writeConfig(config, baseDir);
}

export { getIndexPath, DEFAULT_CONFIG, type DomainSafeConfig };
