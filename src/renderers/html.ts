import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ejs from "ejs";
import type { HideableOutputField } from "../config/types.js";
import type { ScanResult } from "../types/dependency.js";

const DEFAULT_TITLE = "Third-Party Notices";
const DEFAULT_DESCRIPTION = 'Generated using <a href="https://github.com/yagiz-dev/universal-license-notice" target="_blank">Universal License Notice</a> from discovered package metadata.';
const DEFAULT_TEMPLATE_FILE_NAME = "default-template.ejs";

export interface RenderHtmlOptions {
  title?: string;
  description?: string;
  templatePath?: string;
  generatedAt?: Date;
  hideFields?: HideableOutputField[];
}

interface LoadedTemplate {
  filePath: string;
  source: string;
}

function resolveDefaultTemplatePath(): string {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url));
  const sourceTemplatePath = resolve(moduleDirectory, "../templates", DEFAULT_TEMPLATE_FILE_NAME);

  try {
    readFileSync(sourceTemplatePath, "utf8");
    return sourceTemplatePath;
  } catch {
    return resolve(moduleDirectory, "templates", DEFAULT_TEMPLATE_FILE_NAME);
  }
}

function loadTemplate(templatePath?: string): LoadedTemplate {
  const filePath = templatePath ?? resolveDefaultTemplatePath();
  return {
    filePath,
    source: readFileSync(filePath, "utf8"),
  };
}

function formatDependencySummary(
  dependency: Pick<ScanResult["dependencies"][number], "name" | "version" | "licenseExpression">,
  hideFields: Set<HideableOutputField>,
): string {
  const withVersion = hideFields.has("version")
    ? dependency.name
    : `${dependency.name}@${dependency.version}`;
  if (hideFields.has("licenseExpression")) {
    return withVersion;
  }

  return `${withVersion} (${dependency.licenseExpression ?? "Unknown"})`;
}

function displayValue(value?: string): string {
  return value ?? "Unknown";
}

function isHttpUrl(value?: string): boolean {
  return typeof value === "string" && /^https?:\/\//.test(value);
}

export function renderHtml(results: ScanResult[], options: RenderHtmlOptions = {}): string {
  const template = loadTemplate(options.templatePath);
  const hideFields = new Set(options.hideFields ?? []);
  const shouldHideField = (field: HideableOutputField): boolean => hideFields.has(field);

  return ejs.render(
    template.source,
    {
      title: options.title ?? DEFAULT_TITLE,
      description: options.description ?? DEFAULT_DESCRIPTION,
      generatedAt: (options.generatedAt ?? new Date()).toISOString(),
      results,
      displayValue,
      formatDependencySummary: (
        dependency: Pick<
          ScanResult["dependencies"][number],
          "name" | "version" | "licenseExpression"
        >,
      ) => formatDependencySummary(dependency, hideFields),
      shouldHideField,
      isHttpUrl,
    },
    {
      filename: template.filePath,
    },
  );
}
