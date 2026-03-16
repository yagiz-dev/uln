import { join } from "node:path";
import { z } from "zod";
import { normalizeLicenseField } from "../../licenses/normalize.js";
import { readJsonFile } from "../../utils/fs.js";

const lockfilePackageSchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  license: z.union([z.string(), z.array(z.string())]).optional(),
  homepage: z.string().optional(),
  dependencies: z.record(z.string()).optional(),
  devDependencies: z.record(z.string()).optional(),
  optionalDependencies: z.record(z.string()).optional(),
  peerDependencies: z.record(z.string()).optional(),
  repository: z.union([
    z.string(),
    z.object({
      type: z.string().optional(),
      url: z.string().optional(),
    }),
  ]).optional(),
  author: z.union([
    z.string(),
    z.object({
      name: z.string().optional(),
      email: z.string().optional(),
      url: z.string().optional(),
    }),
  ]).optional(),
}).passthrough();

const packageLockSchema = z.object({
  lockfileVersion: z.number(),
  packages: z.record(lockfilePackageSchema).optional(),
});

export interface ParsedLockPackage {
  name: string;
  version: string;
  licenseExpression?: string;
  licenseWarnings: string[];
  homepage?: string;
  repository?: string;
  author?: string;
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

function normalizeRepository(value: z.infer<typeof lockfilePackageSchema>["repository"]): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  return value.url;
}

function normalizeAuthor(value: z.infer<typeof lockfilePackageSchema>["author"]): string | undefined {
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
  licenseWarnings: string[];
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

      return {
        name,
        version: lockPackage.version,
        licenseExpression: normalizedLicense.licenseExpression,
        licenseWarnings: normalizedLicense.licenseWarnings,
        homepage: lockPackage.homepage,
        repository: normalizeRepository(lockPackage.repository),
        author: normalizeAuthor(lockPackage.author),
      } satisfies ParsedLockPackage;
    })
    .filter((entry): entry is ParsedLockPackage => entry !== undefined);

  return {
    lockfileVersion: parsed.lockfileVersion,
    packages,
    directDependencyNames,
  };
}
