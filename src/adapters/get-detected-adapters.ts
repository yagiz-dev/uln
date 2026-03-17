import type { SupportedPackageManagerRegistryEntry } from "../package-managers/registry.js";

export async function getDetectedAdapters(
  projectRoot: string,
  packageManagers: SupportedPackageManagerRegistryEntry[],
): Promise<SupportedPackageManagerRegistryEntry[]> {
  const detectionResults = await Promise.all(
    packageManagers.map(async (packageManager) => ({
      packageManager,
      detected: await packageManager.adapter.detect(projectRoot),
    })),
  );

  return detectionResults.flatMap((result) => (result.detected ? [result.packageManager] : []));
}
