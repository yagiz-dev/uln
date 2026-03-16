import { join } from "node:path";
import type { ScanResult, Warning } from "../../types/dependency.js";
import { fileExists } from "../../utils/fs.js";
import { normalizeDependency } from "../../core/normalize.js";
import { parsePackageJson } from "./parse-package-json.js";
import { parsePackageLock } from "./parse-package-lock.js";

function createWarning(
  code: string,
  message: string,
  packageName?: string,
): Warning {
  return { code, message, packageName };
}

export async function resolveNpmProject(
  projectRoot: string,
): Promise<ScanResult> {
  const packageJsonPath = join(projectRoot, "package.json");
  const packageLockPath = join(projectRoot, "package-lock.json");

  const hasPackageJson = await fileExists(packageJsonPath);
  const hasPackageLock = await fileExists(packageLockPath);

  const warnings: Warning[] = [];
  const packageJsonDirectDependencyNames = hasPackageJson
    ? (await parsePackageJson(projectRoot)).directDependencyNames
    : new Set<string>();

  if (!hasPackageLock) {
    warnings.push(
      createWarning(
        "npm_lockfile_missing",
        "package-lock.json is missing; results only include direct dependencies declared in package.json.",
      ),
    );

    return {
      packageManager: "npm",
      dependencies: [...packageJsonDirectDependencyNames].map((name) =>
        normalizeDependency({
          packageManager: "npm",
          name,
          version: "unknown",
          direct: true,
          warnings: [
            createWarning(
              "npm_version_unknown",
              "Dependency version is unknown without package-lock.json.",
              name,
            ),
            createWarning(
              "license_missing",
              "License metadata is unavailable without package-lock.json.",
              name,
            ),
          ],
        }),
      ),
      warnings,
    };
  }

  const parsedLock = await parsePackageLock(projectRoot);
  const directDependencyNames = new Set<string>([
    ...packageJsonDirectDependencyNames,
    ...parsedLock.directDependencyNames,
  ]);

  if (![2, 3].includes(parsedLock.lockfileVersion)) {
    warnings.push(
      createWarning(
        "npm_lockfile_version_unsupported",
        `Unsupported package-lock.json version ${parsedLock.lockfileVersion}. Results may be incomplete.`,
      ),
    );
  }

  const dependencies = parsedLock.packages.map((pkg) => {
    const dependencyWarnings: Warning[] = [];

    if (!pkg.licenseExpression) {
      dependencyWarnings.push(
        createWarning(
          "license_missing",
          "License metadata is missing from package-lock.json.",
          pkg.name,
        ),
      );
    }

    for (const message of pkg.licenseWarnings) {
      dependencyWarnings.push(
        createWarning("license_normalization_warning", message, pkg.name),
      );
    }

    return normalizeDependency({
      packageManager: "npm",
      name: pkg.name,
      version: pkg.version,
      direct: directDependencyNames.has(pkg.name),
      licenseExpression: pkg.licenseExpression,
      homepage: pkg.homepage,
      repository: pkg.repository,
      author: pkg.author,
      warnings: dependencyWarnings,
    });
  });

  return {
    packageManager: "npm",
    dependencies,
    warnings,
  };
}
