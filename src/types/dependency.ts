import type { SupportedPackageManager } from "./package-manager.js";

export interface Warning {
  code: string;
  message: string;
  packageName?: string;
}

export interface NormalizedDependency {
  packageManager: SupportedPackageManager;
  name: string;
  version: string;
  direct: boolean;
  licenseExpression?: string;
  licenseText?: string;
  licenseSourcePath?: string;
  homepage?: string;
  repository?: string;
  author?: string;
  warnings: Warning[];
}

export interface ScanResult {
  packageManager: SupportedPackageManager;
  dependencies: NormalizedDependency[];
  warnings: Warning[];
}
