import type { ScanResult } from "../types/dependency.js";

export interface PackageManagerAdapter {
  detect(projectRoot: string): Promise<boolean>;
  resolve(projectRoot: string): Promise<ScanResult>;
}
