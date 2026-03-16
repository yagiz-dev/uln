import { join } from "node:path";
import { getDetectedAdapters } from "../adapters/get-detected-adapters.js";
import type { ProjectDiscovery } from "../types/discovery.js";
import {
  getSupportedPackageManagers,
  packageManagerRegistry,
} from "../package-managers/registry.js";
import { fileExists } from "../utils/fs.js";

export async function discoverManagers(
  projectRoot: string,
): Promise<ProjectDiscovery[]> {
  const detectedAdapters = await getDetectedAdapters(
    projectRoot,
    getSupportedPackageManagers(),
  );
  const detectedPackageManagers = new Set<string>(
    detectedAdapters.map((packageManager) => packageManager.name),
  );
  const discoveries: ProjectDiscovery[] = [];

  for (const entry of packageManagerRegistry) {
    const manifests: ProjectDiscovery["manifests"] = [];

    for (const manifest of entry.manifestFiles) {
      if (await fileExists(join(projectRoot, manifest.path))) {
        manifests.push(manifest);
      }
    }

    if (manifests.length === 0) {
      continue;
    }

    const notes: ProjectDiscovery["notes"] = [];

    if (entry.adapter) {
      const hasManifest = manifests.some(
        (manifest) => manifest.kind === "manifest",
      );
      const hasLockfile = manifests.some(
        (manifest) => manifest.kind === "lockfile",
      );

      if (hasManifest && !hasLockfile) {
        notes.push({
          level: "warning",
          message: `Found ${entry.manifestFiles.find((manifest) => manifest.kind === "manifest")?.path ?? "manifest"} without ${entry.manifestFiles.find((manifest) => manifest.kind === "lockfile")?.path ?? "lockfile"}; notice generation will be incomplete.`,
        });
      }

      discoveries.push({
        packageManager: entry.name,
        status: detectedPackageManagers.has(entry.name)
          ? "supported"
          : "unsupported",
        projectRoot,
        manifests,
        notes,
      });
      continue;
    }

    notes.push({
      level: "info",
      message: `${entry.name} manifests were found, but this adapter has not been implemented yet.`,
    });

    discoveries.push({
      packageManager: entry.name,
      status: "unsupported",
      projectRoot,
      manifests,
      notes,
    });
  }

  return discoveries.sort((left, right) =>
    left.packageManager.localeCompare(right.packageManager),
  );
}
