import { isAbsolute, join, resolve } from "node:path";
import { z } from "zod";
import { readJsonFile } from "../../utils/fs.js";

const dependencyMapSchema = z.record(z.string()).default({});

const composerJsonSchema = z.object({
  require: dependencyMapSchema.optional(),
  "require-dev": dependencyMapSchema.optional(),
  config: z
    .object({
      "vendor-dir": z.string().min(1).optional(),
    })
    .optional(),
});

export interface ParsedComposerJson {
  directDependencyNames: Set<string>;
  directDevDependencyNames: Set<string>;
  vendorDirectoryPath: string;
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

export async function parseComposerJson(projectRoot: string): Promise<ParsedComposerJson> {
  const composerJsonPath = join(projectRoot, "composer.json");
  const parsed = composerJsonSchema.parse(await readJsonFile<unknown>(composerJsonPath));

  const directDevDependencyNames = new Set<string>(Object.keys(parsed["require-dev"] ?? {}));
  const directDependencyNames = new Set<string>([
    ...Object.keys(parsed.require ?? {}),
    ...directDevDependencyNames,
  ]);

  for (const packageName of [...directDependencyNames]) {
    if (isComposerPlatformPackage(packageName)) {
      directDependencyNames.delete(packageName);
    }
  }

  for (const packageName of [...directDevDependencyNames]) {
    if (isComposerPlatformPackage(packageName)) {
      directDevDependencyNames.delete(packageName);
    }
  }

  const configuredVendorDirectory = parsed.config?.["vendor-dir"];
  const vendorDirectoryPath = configuredVendorDirectory
    ? isAbsolute(configuredVendorDirectory)
      ? configuredVendorDirectory
      : resolve(projectRoot, configuredVendorDirectory)
    : join(projectRoot, "vendor");

  return { directDependencyNames, directDevDependencyNames, vendorDirectoryPath };
}
