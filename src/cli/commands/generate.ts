import { writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { cwd } from "node:process";
import type { Command } from "commander";
import { loadProjectConfig } from "../../config/load.js";
import {
  HIDEABLE_OUTPUT_FIELDS,
  type HideableOutputField,
  type ProjectConfig,
} from "../../config/types.js";
import { getWarningMessage } from "../../core/warning-codes.js";
import { resolveDependencies } from "../../core/resolve-dependencies.js";
import { renderHtml } from "../../renderers/html.js";
import { renderJson } from "../../renderers/json.js";
import { renderText } from "../../renderers/text.js";
import type { ScanResult } from "../../types/dependency.js";

type OutputFormat = "html" | "text" | "json";

const ANSI_YELLOW = "\u001b[33m";
const ANSI_RESET = "\u001b[0m";
const WARN_LABEL = `${ANSI_YELLOW}WARN${ANSI_RESET}`;
const HIDE_FIELDS_HELP = HIDEABLE_OUTPUT_FIELDS.join(", ");

export interface GenerateCommandOptions {
  config?: string;
  dontIncludeLicenseText?: boolean;
  excludeDev?: boolean;
  format: string;
  hideFields?: string;
  output?: string;
  stdout?: boolean;
}

function defaultOutputPath(format: OutputFormat): string {
  if (format === "json") {
    return "NOTICE.json";
  }

  if (format === "html") {
    return "NOTICE.html";
  }

  return "THIRD_PARTY_NOTICES.txt";
}

function resolveHtmlTemplatePath(
  projectRoot: string,
  configPath: string | undefined,
  templatePath: string | undefined,
): string | undefined {
  if (!templatePath) {
    return undefined;
  }

  if (isAbsolute(templatePath)) {
    return templatePath;
  }

  if (configPath) {
    return resolve(dirname(configPath), templatePath);
  }

  return resolve(projectRoot, templatePath);
}

export function resolveHideFieldsForFormat(
  config: ProjectConfig,
  format: OutputFormat,
): HideableOutputField[] {
  const globalHideFields = config.output?.hideFields ?? [];
  const formatHideFields =
    format === "html"
      ? (config.output?.html?.hideFields ?? [])
      : format === "text"
        ? (config.output?.text?.hideFields ?? [])
        : (config.output?.json?.hideFields ?? []);

  return [...new Set([...globalHideFields, ...formatHideFields])];
}

export function parseHideFieldsOption(
  hideFieldsOption?: string,
): HideableOutputField[] | undefined {
  if (!hideFieldsOption) {
    return undefined;
  }

  const parsedHideFields = [
    ...new Set(hideFieldsOption.split(",").map((field) => field.trim())),
  ].filter((field) => field !== "");

  if (parsedHideFields.length === 0) {
    return [];
  }

  const invalidHideFields = parsedHideFields.filter(
    (field): field is string => !(HIDEABLE_OUTPUT_FIELDS as readonly string[]).includes(field),
  );

  if (invalidHideFields.length > 0) {
    throw new Error(
      `Unsupported --hide-fields value(s): ${invalidHideFields.join(", ")}. Supported values: ${HIDEABLE_OUTPUT_FIELDS.join(", ")}.`,
    );
  }

  return parsedHideFields as HideableOutputField[];
}

export function resolveEffectiveHideFields(
  options: GenerateCommandOptions,
  config: ProjectConfig,
  format: OutputFormat,
): HideableOutputField[] {
  const cliHideFields = parseHideFieldsOption(options.hideFields);

  if (cliHideFields) {
    return cliHideFields;
  }

  return resolveHideFieldsForFormat(config, format);
}

export function shouldWriteToStdout(options: GenerateCommandOptions): boolean {
  return options.stdout === true;
}

export function shouldIncludeLicenseText(options: GenerateCommandOptions): boolean {
  return options.dontIncludeLicenseText !== true;
}

export function shouldIncludeDevDependencies(options: GenerateCommandOptions): boolean {
  return options.excludeDev !== true;
}

export function validateGenerateCommandOptions(options: GenerateCommandOptions): void {
  if (options.format !== "html" && options.format !== "text" && options.format !== "json") {
    throw new Error(
      `Unsupported output format "${options.format}". Use "html", "text", or "json".`,
    );
  }

  if (options.stdout && options.output) {
    throw new Error("The --stdout and --output options cannot be used together.");
  }

  parseHideFieldsOption(options.hideFields);
}

export function collectGenerateWarnings(results: ScanResult[]): string[] {
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    for (const warning of result.warnings) {
      const warningTarget = warning.packageName ? `:${warning.packageName}` : "";
      const warningLine = `${result.packageManager}${warningTarget} ${getWarningMessage(warning)}`;

      if (seen.has(warningLine)) {
        continue;
      }

      seen.add(warningLine);
      warnings.push(warningLine);
    }

    for (const dependency of result.dependencies) {
      for (const warning of dependency.warnings) {
        const warningTarget = warning.packageName ?? dependency.name;
        const warningLine = `${result.packageManager}:${warningTarget} ${getWarningMessage(warning)}`;

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
    .option("--format <format>", "Output format: html, text, json", "html")
    .option("--output <path>", "Write output to the given path")
    .option("--config <path>", "Load configuration from the given JSON file")
    .option("--dont-include-license-text", "Skip bundling full license text for dependencies")
    .option("--exclude-dev", "Exclude development dependencies from generated output")
    .option(
      "--hide-fields <fields>",
      `Comma-separated dependency fields to hide (overrides config hideFields). Supported: ${HIDE_FIELDS_HELP}`,
    )
    .option("--stdout", "Write generated notice output to stdout instead of a file")
    .action(async (options: GenerateCommandOptions) => {
      validateGenerateCommandOptions(options);
      const format = options.format as OutputFormat;
      const loadedConfig = await loadProjectConfig(cwd(), options.config);
      const includeLicenseText = shouldIncludeLicenseText(options);
      const includeDevDependencies = shouldIncludeDevDependencies(options);
      const hideFields = resolveEffectiveHideFields(options, loadedConfig.config, format);
      const htmlConfig = loadedConfig.config.output?.html;
      const htmlTemplatePath = resolveHtmlTemplatePath(
        cwd(),
        loadedConfig.path,
        htmlConfig?.templatePath,
      );

      const results = await resolveDependencies(cwd(), loadedConfig.config, {
        includeLicenseText,
        includeDevDependencies,
      });
      const output =
        format === "json"
          ? renderJson(results, { hideFields })
          : format === "html"
            ? renderHtml(results, {
                title: htmlConfig?.title,
                description: htmlConfig?.description,
                templatePath: htmlTemplatePath,
                hideFields,
              })
            : renderText(results, { hideFields });

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
