import type { SupportedPackageManager } from "./package-manager.js";
import type { WarningCode, WarningDetailsByCode } from "../core/warning-codes.js";

export type Warning = {
  [Code in WarningCode]: Code extends keyof WarningDetailsByCode
    ? { code: Code; packageName?: string; details: WarningDetailsByCode[Code] }
    : { code: Code; packageName?: string; details?: undefined };
}[WarningCode];

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
