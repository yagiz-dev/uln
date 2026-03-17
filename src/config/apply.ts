import { normalizeDependency } from "../core/normalize.js";
import type { ScanResult, Warning } from "../types/dependency.js";
import type { PackageOverride } from "./types.js";
import type { ProjectConfig } from "./types.js";

function matchesPackagePattern(pattern: string, packageName: string): boolean {
  const escapedPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escapedPattern}$`).test(packageName);
}

function findPackageOverride(
  overrides: Record<string, PackageOverride> | undefined,
  packageName: string,
): PackageOverride | undefined {
  if (!overrides) {
    return undefined;
  }

  const exactMatch = overrides[packageName];
  if (exactMatch) {
    return exactMatch;
  }

  return Object.entries(overrides)
    .filter(([pattern]) => pattern.includes("*") && matchesPackagePattern(pattern, packageName))
    .sort(([leftPattern], [rightPattern]) => rightPattern.length - leftPattern.length)[0]?.[1];
}

function isExcluded(excludePatterns: string[], packageName: string): boolean {
  return excludePatterns.some((pattern) => matchesPackagePattern(pattern, packageName));
}

function filterWarnings(warnings: Warning[], hasLicenseOverride: boolean): Warning[] {
  if (!hasLicenseOverride) {
    return warnings;
  }

  return warnings.filter(
    (warning) =>
      warning.code !== "license_missing" && warning.code !== "license_normalization_warning",
  );
}

export function applyProjectConfig(results: ScanResult[], config: ProjectConfig): ScanResult[] {
  return results.map((result) => ({
    ...result,
    dependencies: result.dependencies
      .filter((dependency) => {
        const managerConfig = config.managers[result.packageManager];
        const override = findPackageOverride(managerConfig?.packageOverrides, dependency.name);

        return (
          !isExcluded(managerConfig?.excludePackages ?? [], dependency.name) &&
          override?.exclude !== true
        );
      })
      .map((dependency) => {
        const managerConfig = config.managers[result.packageManager];
        const override = findPackageOverride(managerConfig?.packageOverrides, dependency.name);
        const hasLicenseOverride = override?.licenseExpression !== undefined;

        return normalizeDependency({
          ...dependency,
          licenseExpression: override?.licenseExpression ?? dependency.licenseExpression,
          homepage: override?.homepage ?? dependency.homepage,
          repository: override?.repository ?? dependency.repository,
          author: override?.author ?? dependency.author,
          warnings: filterWarnings(dependency.warnings, hasLicenseOverride),
        });
      }),
  }));
}
