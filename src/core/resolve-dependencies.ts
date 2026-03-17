import { getDetectedAdapters } from "../adapters/get-detected-adapters.js";
import type { ResolveAdapterOptions } from "../adapters/types.js";
import { applyProjectConfig } from "../config/apply.js";
import { defaultProjectConfig, type ProjectConfig } from "../config/types.js";
import { getSupportedPackageManagers } from "../package-managers/registry.js";
import type { ScanResult } from "../types/dependency.js";
import { mergeDependencies } from "./merge-dependencies.js";
import { mergeWarnings } from "./warnings.js";

export async function resolveDependencies(
  projectRoot: string,
  config: ProjectConfig = defaultProjectConfig,
  options: ResolveAdapterOptions = { includeLicenseText: true, includeDevDependencies: true },
): Promise<ScanResult[]> {
  const activeAdapters = await getDetectedAdapters(projectRoot, getSupportedPackageManagers());

  const results = await Promise.all(
    activeAdapters.map(async (packageManager) => {
      const result = await packageManager.adapter.resolve(projectRoot, options);
      return {
        packageManager: result.packageManager,
        dependencies: mergeDependencies(result.dependencies),
        warnings: mergeWarnings(result.warnings),
      };
    }),
  );

  return applyProjectConfig(results, config);
}
