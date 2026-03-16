import type {
  KnownPackageManager,
  PackageManagerStatus,
} from "./package-manager.js";

export interface ManifestRecord {
  kind: "manifest" | "lockfile";
  path: string;
}

export interface DiscoveryNote {
  level: "info" | "warning";
  message: string;
}

export interface ProjectDiscovery {
  packageManager: KnownPackageManager;
  status: PackageManagerStatus;
  projectRoot: string;
  manifests: ManifestRecord[];
  notes: DiscoveryNote[];
}
