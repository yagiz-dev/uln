import { readFile, readdir } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { normalizeDependency } from "../../core/normalize.js";
import {
  WARNING_CODES,
  type WarningCode,
  type WarningDetailsByCode,
} from "../../core/warning-codes.js";
import type { ScanResult, Warning } from "../../types/dependency.js";
import { fileExists } from "../../utils/fs.js";
import { normalizeLicenseField } from "../../licenses/normalize.js";
import type { ResolveAdapterOptions } from "../types.js";
import { parseComposerJson } from "./parse-composer-json.js";
import { parseComposerLock } from "./parse-composer-lock.js";

const DEFAULT_RESOLVE_OPTIONS: ResolveAdapterOptions = {
  includeLicenseText: true,
  includeDevDependencies: true,
};

const LICENSE_FILE_CANDIDATES = ["LICENSE", "LICENSE.txt", "LICENSE.md", "COPYING", "NOTICE"];
const LICENSE_FILE_CANDIDATES_LOWERCASE = new Set(
  LICENSE_FILE_CANDIDATES.map((candidate) => candidate.toLowerCase()),
);

function isLicenseFileCandidate(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();

  if (LICENSE_FILE_CANDIDATES_LOWERCASE.has(lowerName)) {
    return true;
  }

  return (
    lowerName.startsWith("license-") ||
    lowerName.startsWith("license.") ||
    lowerName.startsWith("copying-") ||
    lowerName.startsWith("copying.") ||
    lowerName.startsWith("notice-") ||
    lowerName.startsWith("notice.")
  );
}

function createWarning<Code extends WarningCode>(
  code: Code,
  options?: {
    packageName?: string;
    details?: Code extends keyof WarningDetailsByCode ? WarningDetailsByCode[Code] : never;
  },
): Warning {
  return {
    code,
    packageName: options?.packageName,
    details: options?.details,
  } as Warning;
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
  vendorDirectoryPath: string,
  packageName: string,
  licenseFileHint?: string,
): Promise<{
  licenseText?: string;
  licenseSourcePath?: string;
  packageDirectoryExists: boolean;
}> {
  const packageDirectory = join(vendorDirectoryPath, packageName);

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

  const packageDirectoryEntries = await readdir(packageDirectory, {
    withFileTypes: true,
  }).catch(() => undefined);

  if (!packageDirectoryEntries) {
    return { packageDirectoryExists: true };
  }

  const additionalCandidates = packageDirectoryEntries
    .filter((entry) => entry.isFile() && isLicenseFileCandidate(entry.name))
    .map((entry) => join(packageDirectory, entry.name));

  candidatePaths.push(...additionalCandidates);

  const deduplicatedCandidatePaths = [...new Set(candidatePaths)];

  for (const candidatePath of deduplicatedCandidatePaths) {
    if (!(await fileExists(candidatePath))) {
      continue;
    }

    let contents: string;

    try {
      contents = await readFile(candidatePath, "utf8");
    } catch {
      continue;
    }

    return {
      licenseText: contents.replace(/\r\n/g, "\n").trimEnd(),
      licenseSourcePath: relative(projectRoot, candidatePath),
      packageDirectoryExists: true,
    };
  }

  return { packageDirectoryExists: true };
}

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
): Promise<{
  licenseExpression?: string;
  licenseWarnings: Warning[];
  homepage?: string;
  repository?: string;
  author?: string;
}> {
  const composerJsonPath = join(vendorDirectoryPath, packageName, "composer.json");
  if (!(await fileExists(composerJsonPath))) {
    return {
      licenseExpression: undefined,
      licenseWarnings: [],
      homepage: undefined,
      repository: undefined,
      author: undefined,
    };
  }

  let parsedComposerJson: unknown;

  try {
    parsedComposerJson = JSON.parse(await readFile(composerJsonPath, "utf8"));
  } catch {
    return {
      licenseExpression: undefined,
      licenseWarnings: [],
      homepage: undefined,
      repository: undefined,
      author: undefined,
    };
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
      licenseExpression: undefined,
      licenseWarnings: [],
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
    warnings.push(createWarning(WARNING_CODES.composerLockfileMissing));

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
              createWarning(WARNING_CODES.composerVersionUnknown, { packageName: name }),
              createWarning(WARNING_CODES.licenseMissing, {
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
            : {
                licenseExpression: undefined,
                licenseWarnings: [],
                homepage: undefined,
                repository: undefined,
                author: undefined,
              };

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
            createWarning(WARNING_CODES.licenseMissing, {
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
          ? await getBundledLicense(projectRoot, vendorDirectoryPath, pkg.name, pkg.licenseFileHint)
          : { packageDirectoryExists: false };

        if (
          options.includeLicenseText &&
          bundledLicense.packageDirectoryExists &&
          !bundledLicense.licenseText
        ) {
          dependencyWarnings.push(
            createWarning(WARNING_CODES.licenseFileMissing, { packageName: pkg.name }),
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
