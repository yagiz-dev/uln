import type { SupportedPackageManagerRegistryEntry } from "../package-managers/registry.js";

export async function getDetectedAdapters(
  projectRoot: string,
  packageManagers: SupportedPackageManagerRegistryEntry[],
): Promise<SupportedPackageManagerRegistryEntry[]> {
  const detectedAdapters: SupportedPackageManagerRegistryEntry[] = [];

  for (const packageManager of packageManagers) {
    if (await packageManager.adapter.detect(projectRoot)) {
      detectedAdapters.push(packageManager);
    }
  }

  return detectedAdapters;
}
