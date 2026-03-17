import type { SupportedPackageManager } from "../types/package-manager.js";

export const HIDEABLE_OUTPUT_FIELDS = [
  "version",
  "homepage",
  "repository",
  "author",
  "direct",
  "licenseExpression",
  "licenseText",
  "licenseSourcePath",
] as const;

export type HideableOutputField = (typeof HIDEABLE_OUTPUT_FIELDS)[number];

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
  hideFields?: HideableOutputField[];
}

export interface OutputFormatConfig {
  hideFields?: HideableOutputField[];
}

export interface OutputConfig {
  hideFields?: HideableOutputField[];
  html?: HtmlOutputConfig;
  text?: OutputFormatConfig;
  json?: OutputFormatConfig;
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
