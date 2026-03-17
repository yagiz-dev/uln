import { join } from "node:path";
import { z } from "zod";
import { normalizeLicenseField } from "../../licenses/normalize.js";
import type { Warning } from "../../types/dependency.js";
import { readJsonFile } from "../../utils/fs.js";

const composerLockPackageSchema = z
  .object({
    name: z.string(),
    version: z.string().optional(),
    license: z.union([z.string(), z.array(z.string())]).optional(),
    homepage: z.string().optional(),
    source: z
      .object({
        url: z.string().optional(),
      })
      .passthrough()
      .optional(),
    dist: z
      .object({
        url: z.string().optional(),
      })
      .passthrough()
      .optional(),
    authors: z
      .array(
        z
          .object({
            name: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

const composerLockSchema = z
  .object({
    packages: z.array(composerLockPackageSchema).optional(),
    "packages-dev": z.array(composerLockPackageSchema).optional(),
  })
  .passthrough();

export interface ParsedComposerLockPackage {
  name: string;
  version: string;
  dev: boolean;
  licenseExpression?: string;
  licenseFileHint?: string;
  licenseWarnings: Warning[];
  homepage?: string;
  repository?: string;
  author?: string;
}

export interface ParsedComposerLock {
  packages: ParsedComposerLockPackage[];
}

function isComposerPlatformPackage(packageName: string): boolean {
  return (
    packageName === "php" ||
    packageName === "hhvm" ||
    packageName === "composer" ||
    packageName === "composer-plugin-api" ||
    packageName === "composer-runtime-api" ||
    packageName.startsWith("ext-") ||
    packageName.startsWith("lib-") ||
    packageName.startsWith("php-")
  );
}

function extractLicenseFileHint(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const match = /^SEE LICEN[CS]E IN\s+(.+)$/i.exec(value.trim());
  return match?.[1]?.trim();
}

function normalizeLicense(value: string | string[] | undefined): {
  licenseExpression?: string;
  licenseWarnings: Warning[];
} {
  if (!value) {
    return {
      licenseExpression: undefined,
      licenseWarnings: [],
    };
  }

  const normalized = normalizeLicenseField(value);

  return {
    licenseExpression: normalized.normalizedExpression,
    licenseWarnings: normalized.warnings,
  };
}

export async function parseComposerLock(projectRoot: string): Promise<ParsedComposerLock> {
  const composerLockPath = join(projectRoot, "composer.lock");
  const parsed = composerLockSchema.parse(await readJsonFile<unknown>(composerLockPath));

  const lockPackages = [
    ...(parsed.packages ?? []).map((lockPackage) => ({ lockPackage, dev: false })),
    ...(parsed["packages-dev"] ?? []).map((lockPackage) => ({ lockPackage, dev: true })),
  ];
  const packages = lockPackages
    .map(({ lockPackage, dev }): ParsedComposerLockPackage | undefined => {
      if (isComposerPlatformPackage(lockPackage.name) || !lockPackage.version) {
        return undefined;
      }

      const normalizedLicense = normalizeLicense(lockPackage.license);
      const licenseFileHint = extractLicenseFileHint(lockPackage.license);
      const authorNames = (lockPackage.authors ?? [])
        .map((author) => author.name)
        .filter((name): name is string => typeof name === "string" && name.trim() !== "");

      return {
        name: lockPackage.name,
        version: lockPackage.version,
        dev,
        licenseWarnings: normalizedLicense.licenseWarnings,
        ...(normalizedLicense.licenseExpression
          ? { licenseExpression: normalizedLicense.licenseExpression }
          : {}),
        ...(licenseFileHint ? { licenseFileHint } : {}),
        ...(lockPackage.homepage ? { homepage: lockPackage.homepage } : {}),
        ...(lockPackage.source?.url
          ? { repository: lockPackage.source.url }
          : lockPackage.dist?.url
            ? { repository: lockPackage.dist.url }
            : {}),
        ...(authorNames.length > 0 ? { author: authorNames.join(", ") } : {}),
      };
    })
    .filter((entry): entry is ParsedComposerLockPackage => entry !== undefined);

  return {
    packages,
  };
}
