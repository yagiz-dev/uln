import type { ScanResult } from "../types/dependency.js";
import type { HideableOutputField } from "../config/types.js";
import { getWarningMessage } from "../core/warning-codes.js";

export interface RenderTextOptions {
  hideFields?: HideableOutputField[];
}

function shouldHideField(
  hideFields: Set<HideableOutputField>,
  field: HideableOutputField,
): boolean {
  return hideFields.has(field);
}

function renderDependencyBlock(result: ScanResult, hideFields: Set<HideableOutputField>): string {
  if (result.dependencies.length === 0) {
    return `Package manager: ${result.packageManager}\nNo dependencies found.`;
  }

  return [
    `Package manager: ${result.packageManager}`,
    ...result.dependencies.flatMap((dependency) => [
      "",
      `Package: ${dependency.name}`,
      ...(shouldHideField(hideFields, "version") ? [] : [`Version: ${dependency.version}`]),
      ...(shouldHideField(hideFields, "direct")
        ? []
        : [`Direct: ${dependency.direct ? "yes" : "no"}`]),
      ...(shouldHideField(hideFields, "licenseExpression")
        ? []
        : [`License: ${dependency.licenseExpression ?? "Unknown"}`]),
      ...(shouldHideField(hideFields, "repository")
        ? []
        : [`Repository: ${dependency.repository ?? "Unknown"}`]),
      ...(shouldHideField(hideFields, "homepage")
        ? []
        : [`Homepage: ${dependency.homepage ?? "Unknown"}`]),
      ...(shouldHideField(hideFields, "author")
        ? []
        : [`Author: ${dependency.author ?? "Unknown"}`]),
      ...(dependency.licenseText
        ? [
            ...(shouldHideField(hideFields, "licenseSourcePath")
              ? []
              : [`License file: ${dependency.licenseSourcePath ?? "Unknown"}`]),
            ...(shouldHideField(hideFields, "licenseText")
              ? []
              : ["License text:", dependency.licenseText]),
          ]
        : []),
    ]),
  ].join("\n");
}

function renderWarnings(result: ScanResult): string {
  if (
    result.warnings.length === 0 &&
    result.dependencies.every((dependency) => dependency.warnings.length === 0)
  ) {
    return "";
  }

  const warnings = [
    ...result.warnings.map((warning) => `- ${getWarningMessage(warning)}`),
    ...result.dependencies.flatMap((dependency) =>
      dependency.warnings.map((warning) => `- ${dependency.name}: ${getWarningMessage(warning)}`),
    ),
  ];

  return ["", "Warnings:", ...warnings].join("\n");
}

export function renderText(results: ScanResult[], options: RenderTextOptions = {}): string {
  if (results.length === 0) {
    return "No supported package managers detected in the current project root.";
  }

  const hideFields = new Set(options.hideFields ?? []);

  return results
    .map((result) => `${renderDependencyBlock(result, hideFields)}${renderWarnings(result)}`)
    .join("\n\n");
}
