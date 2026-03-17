import { join } from "node:path";
import { normalizeDependency } from "../../core/normalize.js";
import { WARNING_CODES } from "../../core/warning-codes.js";
import type { ScanResult, Warning } from "../../types/dependency.js";
import { fileExists } from "../../utils/fs.js";
import { normalizeLicenseField } from "../../licenses/normalize.js";
import type { ResolveAdapterOptions } from "../types.js";
import { getBundledLicenseFromDirectory } from "../shared/license-files.js";
import {
  createEmptyResolvedPackageMetadata,
  type ResolvedPackageMetadata,
} from "../shared/metadata.js";
import { parseJsonFileIfExists } from "../shared/read-json.js";
import { createAdapterWarning } from "../shared/warnings.js";
import { parseComposerJson } from "./parse-composer-json.js";
import { parseComposerLock } from "./parse-composer-lock.js";

const DEFAULT_RESOLVE_OPTIONS: ResolveAdapterOptions = {
  includeLicenseText: true,
  includeDevDependencies: true,
};

function normalizeRepositoryFromComposerJson(parsedComposerJson: unknown): string | undefined {
  if (!parsedComposerJson || typeof parsedComposerJson !== "object") {
    return undefined;
  }

  const composerJson = parsedComposerJson as {
    source?: unknown;
    support?: unknown;
    homepage?: unknown;
  };

  if (
    composerJson.source &&
    typeof composerJson.source === "object" &&
    "url" in composerJson.source &&
    typeof composerJson.source.url === "string" &&
    composerJson.source.url.trim() !== ""
  ) {
    return composerJson.source.url;
  }

  if (
    composerJson.support &&
    typeof composerJson.support === "object" &&
    "source" in composerJson.support &&
    typeof composerJson.support.source === "string" &&
    composerJson.support.source.trim() !== ""
  ) {
    return composerJson.support.source;
  }

  if (typeof composerJson.homepage === "string" && composerJson.homepage.trim() !== "") {
    return composerJson.homepage;
  }

  return undefined;
}

function normalizeAuthorFromComposerJson(parsedComposerJson: unknown): string | undefined {
  if (!parsedComposerJson || typeof parsedComposerJson !== "object") {
    return undefined;
  }

  const composerJson = parsedComposerJson as {
    authors?: unknown;
  };

  if (!Array.isArray(composerJson.authors)) {
    return undefined;
  }

  const authorNames = composerJson.authors
    .flatMap((author) => {
      if (
        author &&
        typeof author === "object" &&
        "name" in author &&
        typeof author.name === "string"
      ) {
        return author.name;
      }

      return [];
    })
    .filter((authorName) => authorName.trim() !== "");

  return authorNames.length > 0 ? authorNames.join(", ") : undefined;
}

async function resolveMetadataFromInstalledPackage(
  projectRoot: string,
  vendorDirectoryPath: string,
  packageName: string,
): Promise<ResolvedPackageMetadata> {
  const composerJsonPath = join(vendorDirectoryPath, packageName, "composer.json");
  const parsedComposerJson = await parseJsonFileIfExists(composerJsonPath);
  if (parsedComposerJson === undefined) {
    return createEmptyResolvedPackageMetadata();
  }

  const homepage =
    parsedComposerJson &&
    typeof parsedComposerJson === "object" &&
    "homepage" in parsedComposerJson &&
    typeof parsedComposerJson.homepage === "string" &&
    parsedComposerJson.homepage.trim() !== ""
      ? parsedComposerJson.homepage
      : undefined;

  const repository = normalizeRepositoryFromComposerJson(parsedComposerJson);
  const author = normalizeAuthorFromComposerJson(parsedComposerJson);
  const licenseValues =
    parsedComposerJson &&
    typeof parsedComposerJson === "object" &&
    "license" in parsedComposerJson &&
    (typeof parsedComposerJson.license === "string" || Array.isArray(parsedComposerJson.license))
      ? parsedComposerJson.license
      : undefined;

  if (!licenseValues) {
    return {
      ...createEmptyResolvedPackageMetadata(),
      homepage,
      repository,
      author,
    };
  }

  const normalized = normalizeLicenseField(licenseValues);

  return {
    licenseExpression: normalized.normalizedExpression,
    licenseWarnings: normalized.warnings,
    homepage,
    repository,
    author,
  };
}

export async function resolveComposerProject(
  projectRoot: string,
  options: ResolveAdapterOptions = DEFAULT_RESOLVE_OPTIONS,
): Promise<ScanResult> {
  const composerJsonPath = join(projectRoot, "composer.json");
  const composerLockPath = join(projectRoot, "composer.lock");

  const hasComposerJson = await fileExists(composerJsonPath);
  const hasComposerLock = await fileExists(composerLockPath);

  const warnings: Warning[] = [];
  const parsedComposerJson = hasComposerJson ? await parseComposerJson(projectRoot) : undefined;
  const directDependencyNames = parsedComposerJson?.directDependencyNames ?? new Set<string>();
  const directDevDependencyNames =
    parsedComposerJson?.directDevDependencyNames ?? new Set<string>();
  const vendorDirectoryPath =
    parsedComposerJson?.vendorDirectoryPath ?? join(projectRoot, "vendor");

  if (!hasComposerLock) {
    warnings.push(createAdapterWarning(WARNING_CODES.composerLockfileMissing));

    return {
      packageManager: "composer",
      dependencies: [...directDependencyNames]
        .filter((name) => options.includeDevDependencies || !directDevDependencyNames.has(name))
        .map((name) =>
          normalizeDependency({
            packageManager: "composer",
            name,
            version: "unknown",
            direct: true,
            warnings: [
              createAdapterWarning(WARNING_CODES.composerVersionUnknown, { packageName: name }),
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

  const parsedLock = await parseComposerLock(projectRoot);
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
            ? await resolveMetadataFromInstalledPackage(projectRoot, vendorDirectoryPath, pkg.name)
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
              join(vendorDirectoryPath, pkg.name),
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
          packageManager: "composer",
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
    packageManager: "composer",
    dependencies,
    warnings,
  };
}
