import type { PackageManagerAdapter } from "../adapters/types.js";
import { npmAdapter } from "../adapters/npm/index.js";
import type { ManifestRecord } from "../types/discovery.js";
import type { KnownPackageManager } from "../types/package-manager.js";

export interface PackageManagerRegistryEntry {
  name: KnownPackageManager;
  manifestFiles: ManifestRecord[];
  adapter?: PackageManagerAdapter;
}

export interface SupportedPackageManagerRegistryEntry extends PackageManagerRegistryEntry {
  adapter: PackageManagerAdapter;
}

export const packageManagerRegistry: PackageManagerRegistryEntry[] = [
  {
    name: "npm",
    manifestFiles: [
      { kind: "manifest", path: "package.json" },
      { kind: "lockfile", path: "package-lock.json" },
    ],
    adapter: npmAdapter,
  },
  {
    name: "composer",
    manifestFiles: [
      { kind: "manifest", path: "composer.json" },
      { kind: "lockfile", path: "composer.lock" },
    ],
  },
  {
    name: "pypi",
    manifestFiles: [
      { kind: "manifest", path: "pyproject.toml" },
      { kind: "lockfile", path: "poetry.lock" },
      { kind: "manifest", path: "requirements.txt" },
    ],
  },
];

export function getSupportedPackageManagers(
  registry: PackageManagerRegistryEntry[] = packageManagerRegistry,
): SupportedPackageManagerRegistryEntry[] {
  return registry.flatMap((entry) =>
    entry.adapter ? [{ ...entry, adapter: entry.adapter }] : [],
  );
}
