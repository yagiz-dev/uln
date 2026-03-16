import { join } from "node:path";
import { z } from "zod";
import { readJsonFile } from "../../utils/fs.js";

const dependencyMapSchema = z.record(z.string()).default({});

const packageJsonSchema = z.object({
  dependencies: dependencyMapSchema.optional(),
  devDependencies: dependencyMapSchema.optional(),
  optionalDependencies: dependencyMapSchema.optional(),
  peerDependencies: dependencyMapSchema.optional(),
});

export interface ParsedPackageJson {
  directDependencyNames: Set<string>;
}

export async function parsePackageJson(projectRoot: string): Promise<ParsedPackageJson> {
  const packageJsonPath = join(projectRoot, "package.json");
  const parsed = packageJsonSchema.parse(await readJsonFile<unknown>(packageJsonPath));

  const directDependencyNames = new Set<string>([
    ...Object.keys(parsed.dependencies ?? {}),
    ...Object.keys(parsed.devDependencies ?? {}),
    ...Object.keys(parsed.optionalDependencies ?? {}),
    ...Object.keys(parsed.peerDependencies ?? {}),
  ]);

  return { directDependencyNames };
}
