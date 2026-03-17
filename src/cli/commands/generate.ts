import { writeFile } from "node:fs/promises";
import { cwd } from "node:process";
import type { Command } from "commander";
import { loadProjectConfig } from "../../config/load.js";
import { resolveDependencies } from "../../core/resolve-dependencies.js";
import { renderJson } from "../../renderers/json.js";
import { renderText } from "../../renderers/text.js";
import type { ScanResult } from "../../types/dependency.js";

type OutputFormat = "text" | "json";

const ANSI_YELLOW = "\u001b[33m";
const ANSI_RESET = "\u001b[0m";
const WARN_LABEL = `${ANSI_YELLOW}WARN${ANSI_RESET}`;

export interface GenerateCommandOptions {
  config?: string;
  dontIncludeLicenseText?: boolean;
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

export function shouldIncludeLicenseText(options: GenerateCommandOptions): boolean {
  return options.dontIncludeLicenseText !== true;
}

export function validateGenerateCommandOptions(options: GenerateCommandOptions): void {
  if (options.format !== "text" && options.format !== "json") {
    throw new Error(`Unsupported output format "${options.format}". Use "text" or "json".`);
  }

  if (options.stdout && options.output) {
    throw new Error("The --stdout and --output options cannot be used together.");
  }
}

export function collectGenerateWarnings(results: ScanResult[]): string[] {
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    for (const warning of result.warnings) {
      const warningTarget = warning.packageName ? `:${warning.packageName}` : "";
      const warningLine = `${result.packageManager}${warningTarget} ${warning.message}`;

      if (seen.has(warningLine)) {
        continue;
      }

      seen.add(warningLine);
      warnings.push(warningLine);
    }

    for (const dependency of result.dependencies) {
      for (const warning of dependency.warnings) {
        const warningTarget = warning.packageName ?? dependency.name;
        const warningLine = `${result.packageManager}:${warningTarget} ${warning.message}`;

        if (seen.has(warningLine)) {
          continue;
        }

        seen.add(warningLine);
        warnings.push(warningLine);
      }
    }
  }

  return warnings;
}

export function writeGenerateWarningsToConsole(results: ScanResult[]): void {
  const warningLines = collectGenerateWarnings(results);

  for (const warningLine of warningLines) {
    process.stderr.write(`${WARN_LABEL} ${warningLine}\n`);
  }
}

export function registerGenerateCommand(program: Command): void {
  program
    .command("generate")
    .description("Generate a third-party notice file from the current project root")
    .option("--format <format>", "Output format: text or json", "text")
    .option("--output <path>", "Write output to the given path")
    .option("--config <path>", "Load configuration from the given JSON file")
    .option("--dont-include-license-text", "Skip bundling full license text for dependencies")
    .option("--stdout", "Write generated notice output to stdout instead of a file")
    .action(async (options: GenerateCommandOptions) => {
      validateGenerateCommandOptions(options);
      const format = options.format as OutputFormat;
      const loadedConfig = await loadProjectConfig(cwd(), options.config);
      const includeLicenseText = shouldIncludeLicenseText(options);

      const results = await resolveDependencies(cwd(), loadedConfig.config, {
        includeLicenseText,
      });
      const output = format === "json" ? renderJson(results) : renderText(results);

      if (shouldWriteToStdout(options)) {
        process.stdout.write(`${output}\n`);
        writeGenerateWarningsToConsole(results);
        return;
      }

      const outputPath = options.output ?? defaultOutputPath(format);

      await writeFile(outputPath, `${output}\n`, "utf8");
      writeGenerateWarningsToConsole(results);
      process.stdout.write(`Wrote ${outputPath}\n`);
    });
}
