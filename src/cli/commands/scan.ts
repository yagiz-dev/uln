import { cwd } from "node:process";
import type { Command } from "commander";
import { discoverManagers } from "../../core/discover-managers.js";
import { renderScanReport } from "../../renderers/scan.js";

export function registerScanCommand(program: Command): void {
  program
    .command("scan")
    .description(
      "Report supported package manifests discovered in the current project root",
    )
    .action(async () => {
      const results = await discoverManagers(cwd());
      const output = renderScanReport(results);
      process.stdout.write(`${output}\n`);
    });
}
