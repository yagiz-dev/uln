import { join } from "node:path";
import { z } from "zod";
import { normalizeLicenseField } from "../../licenses/normalize.js";
import type { Warning } from "../../types/dependency.js";
import { readJsonFile } from "../../utils/fs.js";

const lockfilePackageSchema = z
  .object({
    name: z.string().optional(),
    version: z.string().optional(),
    license: z.union([z.string(), z.array(z.string())]).optional(),
    homepage: z.string().optional(),
    dependencies: z.record(z.string()).optional(),
    devDependencies: z.record(z.string()).optional(),
    optionalDependencies: z.record(z.string()).optional(),
    peerDependencies: z.record(z.string()).optional(),
    repository: z
      .union([
        z.string(),
        z.object({
          type: z.string().optional(),
          url: z.string().optional(),
        }),
      ])
      .optional(),
    author: z
      .union([
        z.string(),
        z.object({
          name: z.string().optional(),
          email: z.string().optional(),
          url: z.string().optional(),
        }),
      ])
      .optional(),
  })
  .passthrough();

const packageLockSchema = z.object({
  lockfileVersion: z.number(),
  packages: z.record(lockfilePackageSchema).optional(),
});

export interface ParsedLockPackage {
  name: string;
  packagePath: string;
  version: string;
  licenseExpression?: string;
  licenseFileHint?: string;
  licenseWarnings: Warning[];
  homepage?: string;
  repository?: string;
  author?: string;
}

function extractLicenseFileHint(
  value: z.infer<typeof lockfilePackageSchema>["license"],
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const match = /^SEE LICEN[CS]E IN\s+(.+)$/i.exec(value.trim());
  return match?.[1]?.trim();
}

export interface ParsedPackageLock {
  lockfileVersion: number;
  packages: ParsedLockPackage[];
  directDependencyNames: Set<string>;
}

function packageNameFromPath(packagePath: string): string | undefined {
  if (!packagePath.startsWith("node_modules/")) {
    return undefined;
  }

  const segments = packagePath.split("node_modules/").filter(Boolean);
  const packageName = segments.at(-1);

  return packageName === "" ? undefined : packageName;
}

function normalizeRepository(
  value: z.infer<typeof lockfilePackageSchema>["repository"],
): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  return value.url;
}

function normalizeAuthor(
  value: z.infer<typeof lockfilePackageSchema>["author"],
): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  return value.name;
}

function normalizeLicense(value: z.infer<typeof lockfilePackageSchema>["license"]): {
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

export async function parsePackageLock(projectRoot: string): Promise<ParsedPackageLock> {
  const packageLockPath = join(projectRoot, "package-lock.json");
  const parsed = packageLockSchema.parse(await readJsonFile<unknown>(packageLockPath));
  const directDependencyNames = new Set<string>();

  const packages = Object.entries(parsed.packages ?? {})
    .map(([packagePath, lockPackage]) => {
      if (packagePath === "" || !packagePath.startsWith("node_modules/")) {
        for (const dependencyName of Object.keys(lockPackage.dependencies ?? {})) {
          directDependencyNames.add(dependencyName);
        }

        for (const dependencyName of Object.keys(lockPackage.devDependencies ?? {})) {
          directDependencyNames.add(dependencyName);
        }

        for (const dependencyName of Object.keys(lockPackage.optionalDependencies ?? {})) {
          directDependencyNames.add(dependencyName);
        }

        for (const dependencyName of Object.keys(lockPackage.peerDependencies ?? {})) {
          directDependencyNames.add(dependencyName);
        }
      }

      const name = packageNameFromPath(packagePath);
      if (!name || !lockPackage.version) {
        return undefined;
      }

      const normalizedLicense = normalizeLicense(lockPackage.license);
      const licenseFileHint = extractLicenseFileHint(lockPackage.license);
      const repository = normalizeRepository(lockPackage.repository);
      const author = normalizeAuthor(lockPackage.author);

      const parsedPackage: ParsedLockPackage = {
        name,
        packagePath,
        version: lockPackage.version,
        licenseWarnings: normalizedLicense.licenseWarnings,
        ...(normalizedLicense.licenseExpression
          ? { licenseExpression: normalizedLicense.licenseExpression }
          : {}),
        ...(licenseFileHint ? { licenseFileHint } : {}),
        ...(lockPackage.homepage ? { homepage: lockPackage.homepage } : {}),
        ...(repository ? { repository } : {}),
        ...(author ? { author } : {}),
      };

      return parsedPackage;
    })
    .filter((entry): entry is ParsedLockPackage => entry !== undefined);

  return {
    lockfileVersion: parsed.lockfileVersion,
    packages,
    directDependencyNames,
  };
}
