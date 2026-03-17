import { writeFile } from "node:fs/promises";
import { cwd } from "node:process";
import type { Command } from "commander";
import { loadProjectConfig } from "../../config/load.js";
import { resolveDependencies } from "../../core/resolve-dependencies.js";
import { renderJson } from "../../renderers/json.js";
import { renderText } from "../../renderers/text.js";

type OutputFormat = "text" | "json";

export interface GenerateCommandOptions {
  config?: string;
  format: string;
  output?: string;
  stdout?: boolean;
}

function defaultOutputPath(format: OutputFormat): string {
  return format === "json" ? "NOTICE.json" : "THIRD_PARTY_NOTICES.txt";
}

export function shouldWriteToStdout(options: GenerateCommandOptions): boolean {
  return options.stdout === true;
}

export function validateGenerateCommandOptions(options: GenerateCommandOptions): void {
  if (options.format !== "text" && options.format !== "json") {
    throw new Error(`Unsupported output format \"${options.format}\". Use \"text\" or \"json\".`);
  }

  if (options.stdout && options.output) {
    throw new Error("The --stdout and --output options cannot be used together.");
  }
}

export function registerGenerateCommand(program: Command): void {
  program
    .command("generate")
    .description("Generate a third-party notice file from the current project root")
    .option("--format <format>", "Output format: text or json", "text")
    .option("--output <path>", "Write output to the given path")
    .option("--config <path>", "Load configuration from the given JSON file")
    .option("--stdout", "Write generated notice output to stdout instead of a file")
    .action(async (options: GenerateCommandOptions) => {
      validateGenerateCommandOptions(options);
      const format = options.format as OutputFormat;
      const loadedConfig = await loadProjectConfig(cwd(), options.config);

      const results = await resolveDependencies(cwd(), loadedConfig.config);
      const output = format === "json" ? renderJson(results) : renderText(results);

      if (shouldWriteToStdout(options)) {
        process.stdout.write(`${output}\n`);
        return;
      }

      const outputPath = options.output ?? defaultOutputPath(format);

      await writeFile(outputPath, `${output}\n`, "utf8");
      process.stdout.write(`Wrote ${outputPath}\n`);
    });
}
