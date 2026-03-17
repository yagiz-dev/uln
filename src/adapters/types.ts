import type { ScanResult } from "../types/dependency.js";

export interface ResolveAdapterOptions {
  includeLicenseText: boolean;
  includeDevDependencies?: boolean;
}

export interface PackageManagerAdapter {
  detect(projectRoot: string): Promise<boolean>;
  resolve(projectRoot: string, options: ResolveAdapterOptions): Promise<ScanResult>;
}
