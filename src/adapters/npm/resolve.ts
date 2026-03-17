import { readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { ResolveAdapterOptions } from "../types.js";
import type { ScanResult, Warning } from "../../types/dependency.js";
import { fileExists } from "../../utils/fs.js";
import { normalizeDependency } from "../../core/normalize.js";
import { WARNING_MESSAGES } from "../../core/warning-messages.js";
import { parsePackageJson } from "./parse-package-json.js";
import { parsePackageLock } from "./parse-package-lock.js";

const DEFAULT_RESOLVE_OPTIONS: ResolveAdapterOptions = {
  includeLicenseText: true,
};

const LICENSE_FILE_CANDIDATES = ["LICENSE", "LICENSE.txt", "LICENSE.md", "COPYING", "NOTICE"];

function createWarning(code: string, message: string, packageName?: string): Warning {
  return { code, message, packageName };
}

function toSafePackagePath(packageDirectory: string, candidatePath: string): string | undefined {
  const resolvedCandidate = resolve(packageDirectory, candidatePath);
  const relativePath = relative(packageDirectory, resolvedCandidate);

  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return undefined;
  }

  return resolvedCandidate;
}

async function getBundledLicense(
  projectRoot: string,
  packagePath: string,
  licenseFileHint?: string,
): Promise<{
  licenseText?: string;
  licenseSourcePath?: string;
  packageDirectoryExists: boolean;
}> {
  const packageDirectory = join(projectRoot, packagePath);

  if (!(await fileExists(packageDirectory))) {
    return { packageDirectoryExists: false };
  }

  const candidatePaths: string[] = [];

  if (licenseFileHint) {
    const hintedPath = toSafePackagePath(packageDirectory, licenseFileHint);
    if (hintedPath) {
      candidatePaths.push(hintedPath);
    }
  }

  for (const fileName of LICENSE_FILE_CANDIDATES) {
    candidatePaths.push(join(packageDirectory, fileName));
    candidatePaths.push(join(packageDirectory, fileName.toLowerCase()));
  }

  for (const candidatePath of candidatePaths) {
    if (!(await fileExists(candidatePath))) {
      continue;
    }

    const contents = await readFile(candidatePath, "utf8");
    return {
      licenseText: contents.replace(/\r\n/g, "\n").trimEnd(),
      licenseSourcePath: relative(projectRoot, candidatePath),
      packageDirectoryExists: true,
    };
  }

  return { packageDirectoryExists: true };
}

export async function resolveNpmProject(
  projectRoot: string,
  options: ResolveAdapterOptions = DEFAULT_RESOLVE_OPTIONS,
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
    warnings.push(createWarning("npm_lockfile_missing", WARNING_MESSAGES.npmLockfileMissing));

    return {
      packageManager: "npm",
      dependencies: [...packageJsonDirectDependencyNames].map((name) =>
        normalizeDependency({
          packageManager: "npm",
          name,
          version: "unknown",
          direct: true,
          warnings: [
            createWarning("npm_version_unknown", WARNING_MESSAGES.npmVersionUnknown, name),
            createWarning(
              "license_missing",
              WARNING_MESSAGES.licenseUnavailableWithoutLockfile,
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
        WARNING_MESSAGES.npmLockfileVersionUnsupported(parsedLock.lockfileVersion),
      ),
    );
  }

  const dependencies = await Promise.all(
    parsedLock.packages.map(async (pkg) => {
      const dependencyWarnings: Warning[] = [];

      if (!pkg.licenseExpression) {
        dependencyWarnings.push(
          createWarning("license_missing", WARNING_MESSAGES.licenseMissingFromLockfile, pkg.name),
        );
      }

      for (const message of pkg.licenseWarnings) {
        if (options.includeLicenseText && message === WARNING_MESSAGES.licenseFileReference) {
          continue;
        }

        dependencyWarnings.push(createWarning("license_normalization_warning", message, pkg.name));
      }

      const bundledLicense = options.includeLicenseText
        ? await getBundledLicense(projectRoot, pkg.packagePath, pkg.licenseFileHint)
        : { packageDirectoryExists: false };

      if (
        options.includeLicenseText &&
        bundledLicense.packageDirectoryExists &&
        !bundledLicense.licenseText
      ) {
        dependencyWarnings.push(
          createWarning("license_file_missing", WARNING_MESSAGES.licenseFileMissing, pkg.name),
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
        licenseText: bundledLicense.licenseText,
        licenseSourcePath: bundledLicense.licenseSourcePath,
        warnings: dependencyWarnings,
      });
    }),
  );

  return {
    packageManager: "npm",
    dependencies,
    warnings,
  };
}
