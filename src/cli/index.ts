#!/usr/bin/env node

import { Command } from "commander";
import { registerGenerateCommand } from "./commands/generate.js";
import { registerScanCommand } from "./commands/scan.js";

const program = new Command();

program
  .name("uln")
  .description("Generate third-party license notices from package metadata")
  .version("0.1.0");

registerScanCommand(program);
registerGenerateCommand(program);

await program.parseAsync(process.argv);
