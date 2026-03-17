import type { SupportedPackageManager } from "../types/package-manager.js";

export interface PackageOverride {
  exclude?: boolean;
  licenseExpression?: string;
  homepage?: string;
  repository?: string;
  author?: string;
}

export interface PackageManagerConfig {
  excludePackages: string[];
  packageOverrides: Record<string, PackageOverride>;
}

export interface HtmlOutputConfig {
  title?: string;
  description?: string;
  templatePath?: string;
}

export interface OutputConfig {
  html?: HtmlOutputConfig;
}

export interface ProjectConfig {
  managers: Partial<Record<SupportedPackageManager, PackageManagerConfig>>;
  output?: OutputConfig;
}

export interface LoadedProjectConfig {
  path?: string;
  config: ProjectConfig;
}

export const defaultProjectConfig: ProjectConfig = {
  managers: {},
};
