#!/usr/bin/env node

import { Command } from "commander";
import { registerGenerateCommand } from "./commands/generate.js";
import { registerLicenseCommand } from "./commands/license.js";
import { registerScanCommand } from "./commands/scan.js";

const program = new Command();

program
  .name("uln")
  .description("Generate third-party license notices from package metadata")
  .version("0.1.0")
  .addHelpText("after", `\nMade by Yağızhan Burak Yakar (https://yagiz.dev)\nLicensed under MIT.\n`);

registerScanCommand(program);
registerGenerateCommand(program);
registerLicenseCommand(program);

await program.parseAsync(process.argv);
