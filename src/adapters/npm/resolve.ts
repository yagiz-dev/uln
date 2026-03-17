import { join } from "node:path";
import type { ResolveAdapterOptions } from "../types.js";
import type { ScanResult, Warning } from "../../types/dependency.js";
import { fileExists } from "../../utils/fs.js";
import { normalizeDependency } from "../../core/normalize.js";
import { WARNING_CODES } from "../../core/warning-codes.js";
import { normalizeLicenseField } from "../../licenses/normalize.js";
import { getBundledLicenseFromDirectory } from "../shared/license-files.js";
import {
  createEmptyResolvedPackageMetadata,
  type ResolvedPackageMetadata,
} from "../shared/metadata.js";
import { parseJsonFileIfExists } from "../shared/read-json.js";
import { createAdapterWarning } from "../shared/warnings.js";
import { parsePackageJson } from "./parse-package-json.js";
import { parsePackageLock } from "./parse-package-lock.js";

const DEFAULT_RESOLVE_OPTIONS: ResolveAdapterOptions = {
  includeLicenseText: true,
  includeDevDependencies: true,
};

function collectLegacyLicenseValues(parsedPackageJson: unknown): string[] {
  if (!parsedPackageJson || typeof parsedPackageJson !== "object") {
    return [];
  }

  const packageJson = parsedPackageJson as {
    license?: unknown;
    licenses?: unknown;
  };

  if (typeof packageJson.license === "string" && packageJson.license.trim() !== "") {
    return [packageJson.license];
  }

  if (
    Array.isArray(packageJson.license) &&
    packageJson.license.every((license) => typeof license === "string")
  ) {
    return packageJson.license.filter((license) => license.trim() !== "");
  }

  if (!Array.isArray(packageJson.licenses)) {
    return [];
  }

  const legacyValues = packageJson.licenses.flatMap((license) => {
    if (typeof license === "string") {
      return license;
    }

    if (
      license &&
      typeof license === "object" &&
      "type" in license &&
      typeof license.type === "string"
    ) {
      return license.type;
    }

    return [];
  });

  return legacyValues.filter((license) => license.trim() !== "");
}

function normalizeRepositoryFromPackageJson(parsedPackageJson: unknown): string | undefined {
  if (!parsedPackageJson || typeof parsedPackageJson !== "object") {
    return undefined;
  }

  const packageJson = parsedPackageJson as {
    repository?: unknown;
  };

  if (typeof packageJson.repository === "string") {
    return packageJson.repository;
  }

  if (
    packageJson.repository &&
    typeof packageJson.repository === "object" &&
    "url" in packageJson.repository &&
    typeof packageJson.repository.url === "string" &&
    packageJson.repository.url.trim() !== ""
  ) {
    return packageJson.repository.url;
  }

  return undefined;
}

function normalizeAuthorFromPackageJson(parsedPackageJson: unknown): string | undefined {
  if (!parsedPackageJson || typeof parsedPackageJson !== "object") {
    return undefined;
  }

  const packageJson = parsedPackageJson as {
    author?: unknown;
  };

  if (typeof packageJson.author === "string") {
    return packageJson.author;
  }

  if (
    packageJson.author &&
    typeof packageJson.author === "object" &&
    "name" in packageJson.author &&
    typeof packageJson.author.name === "string" &&
    packageJson.author.name.trim() !== ""
  ) {
    return packageJson.author.name;
  }

  return undefined;
}

async function resolveMetadataFromInstalledPackage(
  projectRoot: string,
  packagePath: string,
): Promise<ResolvedPackageMetadata> {
  const packageJsonPath = join(projectRoot, packagePath, "package.json");
  const parsedPackageJson = await parseJsonFileIfExists(packageJsonPath);
  if (parsedPackageJson === undefined) {
    return createEmptyResolvedPackageMetadata();
  }

  const licenseValues = collectLegacyLicenseValues(parsedPackageJson);
  const homepage =
    parsedPackageJson &&
    typeof parsedPackageJson === "object" &&
    "homepage" in parsedPackageJson &&
    typeof parsedPackageJson.homepage === "string" &&
    parsedPackageJson.homepage.trim() !== ""
      ? parsedPackageJson.homepage
      : undefined;

  const repository = normalizeRepositoryFromPackageJson(parsedPackageJson);
  const author = normalizeAuthorFromPackageJson(parsedPackageJson);

  if (licenseValues.length === 0) {
    return {
      ...createEmptyResolvedPackageMetadata(),
      homepage,
      repository,
      author,
    };
  }

  const singleLicenseValue = licenseValues[0];
  const normalized =
    licenseValues.length === 1 && singleLicenseValue
      ? normalizeLicenseField(singleLicenseValue)
      : normalizeLicenseField(licenseValues);

  return {
    licenseExpression: normalized.normalizedExpression,
    licenseWarnings: normalized.warnings,
    homepage,
    repository,
    author,
  };
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
  const parsedPackageJson = hasPackageJson ? await parsePackageJson(projectRoot) : undefined;
  const packageJsonDirectDependencyNames =
    parsedPackageJson?.directDependencyNames ?? new Set<string>();
  const packageJsonDirectDevDependencyNames =
    parsedPackageJson?.directDevDependencyNames ?? new Set<string>();

  if (!hasPackageLock) {
    warnings.push(createAdapterWarning(WARNING_CODES.npmLockfileMissing));

    return {
      packageManager: "npm",
      dependencies: [...packageJsonDirectDependencyNames]
        .filter(
          (name) =>
            options.includeDevDependencies || !packageJsonDirectDevDependencyNames.has(name),
        )
        .map((name) =>
          normalizeDependency({
            packageManager: "npm",
            name,
            version: "unknown",
            direct: true,
            warnings: [
              createAdapterWarning(WARNING_CODES.npmVersionUnknown, { packageName: name }),
              createAdapterWarning(WARNING_CODES.licenseMissing, {
                packageName: name,
                details: { reason: "without_lockfile" },
              }),
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
      createAdapterWarning(WARNING_CODES.npmLockfileVersionUnsupported, {
        details: { lockfileVersion: parsedLock.lockfileVersion },
      }),
    );
  }

  const dependencies = await Promise.all(
    parsedLock.packages
      .filter((pkg) => options.includeDevDependencies || !pkg.dev)
      .map(async (pkg) => {
        const dependencyWarnings: Warning[] = [];
        let licenseExpression = pkg.licenseExpression;
        let homepage = pkg.homepage;
        let repository = pkg.repository;
        let author = pkg.author;

        const fallbackMetadata =
          !licenseExpression || !homepage || !repository || !author
            ? await resolveMetadataFromInstalledPackage(projectRoot, pkg.packagePath)
            : createEmptyResolvedPackageMetadata();

        if (!licenseExpression && fallbackMetadata.licenseExpression) {
          licenseExpression = fallbackMetadata.licenseExpression;
        }

        if (!homepage && fallbackMetadata.homepage) {
          homepage = fallbackMetadata.homepage;
        }

        if (!repository && fallbackMetadata.repository) {
          repository = fallbackMetadata.repository;
        }

        if (!author && fallbackMetadata.author) {
          author = fallbackMetadata.author;
        }

        if (!licenseExpression) {
          dependencyWarnings.push(
            createAdapterWarning(WARNING_CODES.licenseMissing, {
              packageName: pkg.name,
              details: { reason: "missing_from_lockfile" },
            }),
          );
        }

        for (const warning of [...pkg.licenseWarnings, ...fallbackMetadata.licenseWarnings]) {
          if (options.includeLicenseText && warning.code === WARNING_CODES.licenseFileReference) {
            continue;
          }

          dependencyWarnings.push({ ...warning, packageName: pkg.name });
        }

        const bundledLicense = options.includeLicenseText
          ? await getBundledLicenseFromDirectory(
              projectRoot,
              join(projectRoot, pkg.packagePath),
              pkg.licenseFileHint,
            )
          : { packageDirectoryExists: false };

        if (
          options.includeLicenseText &&
          bundledLicense.packageDirectoryExists &&
          !bundledLicense.licenseText
        ) {
          dependencyWarnings.push(
            createAdapterWarning(WARNING_CODES.licenseFileMissing, { packageName: pkg.name }),
          );
        }

        return normalizeDependency({
          packageManager: "npm",
          name: pkg.name,
          version: pkg.version,
          direct: directDependencyNames.has(pkg.name),
          licenseExpression,
          homepage,
          repository,
          author,
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
