import pc from "picocolors";
import { Command } from "commander";
import { initProject } from "./config/index.js";
import { runUpdate } from "./commands/update.js";
import { runCheck, runStats, runDoctor } from "./commands/check.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("domain-safe")
    .description("Offline domain reputation checks using downloadable blacklists")
    .version("0.1.0");

  program
    .command("init")
    .description("Create .domain-safe/ and domain-safe.config.json")
    .action(async () => {
      try {
        await initProject();
        console.log(pc.green("✔ Initialized domain-safe"));
        console.log("  Created domain-safe.config.json");
        console.log("  Created .domain-safe/");
        console.log("\nNext: run `domain-safe update` to download and build the index");
      } catch (err) {
        console.error(pc.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });

  program
    .command("update")
    .description("Download sources, parse, and build binary index")
    .action(async () => {
      try {
        const { loadConfig } = await import("./config/index.js");
        const config = await loadConfig();
        console.log(pc.bold("Updating domain-safe index..."));
        const result = await runUpdate(config);
        console.log(pc.green("✔ Index updated"));
        console.log(`  Domains:  ${result.domainCount.toLocaleString()}`);
        console.log(`  Raw:      ${result.rawEntries.toLocaleString()} entries`);
        console.log(`  Duration: ${result.durationMs}ms`);
        console.log(`  Path:     ${result.indexPath}`);
      } catch (err) {
        console.error(pc.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });

  program
    .command("check")
    .description("Check if a domain is listed")
    .argument("<domain>", "Domain to check")
    .action(async (domain: string) => {
      try {
        const code = await runCheck(domain);
        process.exit(code);
      } catch (err) {
        console.error(pc.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });

  program
    .command("stats")
    .description("Show index statistics")
    .action(async () => {
      try {
        await runStats();
      } catch (err) {
        console.error(pc.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });

  program
    .command("doctor")
    .description("Check configuration, index integrity, and source availability")
    .action(async () => {
      try {
        const code = await runDoctor();
        process.exit(code);
      } catch (err) {
        console.error(pc.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });

  return program;
}

createProgram().parse();
