import type { ScanResult } from "../types/dependency.js";

function renderDependencyBlock(result: ScanResult): string {
  if (result.dependencies.length === 0) {
    return `Package manager: ${result.packageManager}\nNo dependencies found.`;
  }

  return [
    `Package manager: ${result.packageManager}`,
    ...result.dependencies.flatMap((dependency) => [
      "",
      `Package: ${dependency.name}`,
      `Version: ${dependency.version}`,
      `Direct: ${dependency.direct ? "yes" : "no"}`,
      `License: ${dependency.licenseExpression ?? "Unknown"}`,
      `Repository: ${dependency.repository ?? "Unknown"}`,
      `Homepage: ${dependency.homepage ?? "Unknown"}`,
      `Author: ${dependency.author ?? "Unknown"}`,
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
    ...result.warnings.map((warning) => `- ${warning.message}`),
    ...result.dependencies.flatMap((dependency) =>
      dependency.warnings.map(
        (warning) => `- ${dependency.name}: ${warning.message}`,
      ),
    ),
  ];

  return ["", "Warnings:", ...warnings].join("\n");
}

export function renderText(results: ScanResult[]): string {
  if (results.length === 0) {
    return "No supported package managers detected in the current project root.";
  }

  return results
    .map(
      (result) => `${renderDependencyBlock(result)}${renderWarnings(result)}`,
    )
    .join("\n\n");
}
