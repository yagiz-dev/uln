import { writeFile } from "node:fs/promises";
import { cwd } from "node:process";
import type { Command } from "commander";
import { resolveDependencies } from "../../core/resolve-dependencies.js";
import { renderJson } from "../../renderers/json.js";
import { renderText } from "../../renderers/text.js";

type OutputFormat = "text" | "json";

export interface GenerateCommandOptions {
  format: OutputFormat;
  output?: string;
  stdout?: boolean;
}

function defaultOutputPath(format: OutputFormat): string {
  return format === "json" ? "NOTICE.json" : "THIRD_PARTY_NOTICES.txt";
}

export function shouldWriteToStdout(options: GenerateCommandOptions): boolean {
  return options.stdout === true;
}

export function validateGenerateCommandOptions(
  options: GenerateCommandOptions,
): void {
  if (options.stdout && options.output) {
    throw new Error(
      "The --stdout and --output options cannot be used together.",
    );
  }
}

export function registerGenerateCommand(program: Command): void {
  program
    .command("generate")
    .description(
      "Generate a third-party notice file from the current project root",
    )
    .option("--format <format>", "Output format: text or json", "text")
    .option("--output <path>", "Write output to the given path")
    .option(
      "--stdout",
      "Write generated notice output to stdout instead of a file",
    )
    .action(async (options: GenerateCommandOptions) => {
      validateGenerateCommandOptions(options);

      const results = await resolveDependencies(cwd());
      const output =
        options.format === "json" ? renderJson(results) : renderText(results);

      if (shouldWriteToStdout(options)) {
        process.stdout.write(`${output}\n`);
        return;
      }

      const outputPath = options.output ?? defaultOutputPath(options.format);

      await writeFile(outputPath, `${output}\n`, "utf8");
      process.stdout.write(`Wrote ${outputPath}\n`);
    });
}
