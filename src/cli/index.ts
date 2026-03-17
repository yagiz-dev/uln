#!/usr/bin/env node

import { Command } from "commander";
import { registerGenerateCommand } from "./commands/generate.js";
import { registerLicenseCommand } from "./commands/license.js";
import { registerScanCommand } from "./commands/scan.js";

declare const __ULN_VERSION__: string | undefined;

const programVersion =
  typeof __ULN_VERSION__ === "string"
    ? __ULN_VERSION__
    : (process.env.npm_package_version ?? "0.0.0");

const program = new Command();

program
  .name("uln")
  .description("Generate third-party license notices from package metadata")
  .version(programVersion)
  .addHelpText(
    "after",
    `\nMade by Yağızhan Burak Yakar (https://yagiz.dev)\nSource code available in:https://github.com/yagiz-dev/universal-license-notice\nLicensed under MIT.\n`,
  );

registerScanCommand(program);
registerGenerateCommand(program);
registerLicenseCommand(program);

try {
  await program.parseAsync(process.argv);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
