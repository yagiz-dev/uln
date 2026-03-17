import { join, resolve, isAbsolute } from "node:path";
import { z } from "zod";
import { fileExists, readJsonFile } from "../utils/fs.js";
import {
  defaultProjectConfig,
  HIDEABLE_OUTPUT_FIELDS,
  type HtmlOutputConfig,
  type HideableOutputField,
  type LoadedProjectConfig,
  type OutputConfig,
  type OutputFormatConfig,
  type PackageManagerConfig,
  type PackageOverride,
  type ProjectConfig,
} from "./types.js";

const packageOverrideSchema = z.object({
  exclude: z.boolean().optional(),
  licenseExpression: z.string().min(1).optional(),
  homepage: z.string().min(1).optional(),
  repository: z.string().min(1).optional(),
  author: z.string().min(1).optional(),
});

const packageManagerConfigSchema = z.object({
  excludePackages: z.array(z.string().min(1)).default([]),
  packageOverrides: z.record(z.string(), packageOverrideSchema).default({}),
});

const htmlOutputConfigSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  templatePath: z.string().min(1).optional(),
  hideFields: z.array(z.enum(HIDEABLE_OUTPUT_FIELDS)).optional(),
});

const outputFormatConfigSchema = z.object({
  hideFields: z.array(z.enum(HIDEABLE_OUTPUT_FIELDS)).optional(),
});

const projectConfigSchema = z.object({
  managers: z
    .object({
      npm: packageManagerConfigSchema.optional(),
      composer: packageManagerConfigSchema.optional(),
    })
    .default({}),
  output: z
    .object({
      hideFields: z.array(z.enum(HIDEABLE_OUTPUT_FIELDS)).optional(),
      html: htmlOutputConfigSchema.optional(),
      text: outputFormatConfigSchema.optional(),
      json: outputFormatConfigSchema.optional(),
    })
    .optional(),
});

export const DEFAULT_CONFIG_FILE_NAME = "uln.config.json";

function resolveConfigPath(projectRoot: string, configPath?: string): string {
  if (!configPath) {
    return join(projectRoot, DEFAULT_CONFIG_FILE_NAME);
  }

  return isAbsolute(configPath) ? configPath : resolve(projectRoot, configPath);
}

function normalizePackageManagerConfig(config: PackageManagerConfig): PackageManagerConfig {
  return {
    excludePackages: [...new Set(config.excludePackages)],
    packageOverrides: Object.fromEntries(
      Object.entries(config.packageOverrides).map(([packageName, override]) => [
        packageName,
        override,
      ]),
    ) as Record<string, PackageOverride>,
  };
}

function normalizeProjectConfig(config: ProjectConfig): ProjectConfig {
  const normalizedManagers: ProjectConfig["managers"] = {};

  for (const packageManager of Object.keys(config.managers) as Array<
    keyof ProjectConfig["managers"]
  >) {
    const managerConfig = config.managers[packageManager];

    if (!managerConfig) {
      continue;
    }

    normalizedManagers[packageManager] = normalizePackageManagerConfig(managerConfig);
  }

  let normalizedOutput: OutputConfig | undefined;

  if (config.output) {
    normalizedOutput = {
      ...(config.output.hideFields
        ? { hideFields: normalizeHideFields(config.output.hideFields) }
        : {}),
      ...(config.output.html ? { html: normalizeHtmlOutputConfig(config.output.html) } : {}),
      ...(config.output.text ? { text: normalizeOutputFormatConfig(config.output.text) } : {}),
      ...(config.output.json ? { json: normalizeOutputFormatConfig(config.output.json) } : {}),
    };

    if (Object.keys(normalizedOutput).length === 0) {
      normalizedOutput = undefined;
    }
  }

  return {
    managers: normalizedManagers,
    ...(normalizedOutput ? { output: normalizedOutput } : {}),
  };
}

function normalizeHtmlOutputConfig(config: HtmlOutputConfig): HtmlOutputConfig {
  return {
    ...(config.title ? { title: config.title } : {}),
    ...(config.description ? { description: config.description } : {}),
    ...(config.templatePath ? { templatePath: config.templatePath } : {}),
    ...(config.hideFields ? { hideFields: normalizeHideFields(config.hideFields) } : {}),
  };
}

function normalizeOutputFormatConfig(config: OutputFormatConfig): OutputFormatConfig {
  return {
    ...(config.hideFields ? { hideFields: normalizeHideFields(config.hideFields) } : {}),
  };
}

function normalizeHideFields(fields: HideableOutputField[]): HideableOutputField[] {
  return [...new Set(fields)];
}

export async function loadProjectConfig(
  projectRoot: string,
  configPath?: string,
): Promise<LoadedProjectConfig> {
  const resolvedConfigPath = resolveConfigPath(projectRoot, configPath);

  if (!(await fileExists(resolvedConfigPath))) {
    if (configPath) {
      throw new Error(`Configuration file not found: ${resolvedConfigPath}`);
    }

    return { config: defaultProjectConfig };
  }

  const parsed = projectConfigSchema.parse(await readJsonFile<unknown>(resolvedConfigPath));

  return {
    path: resolvedConfigPath,
    config: normalizeProjectConfig(parsed),
  };
}
