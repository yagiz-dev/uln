import { join, resolve, isAbsolute } from "node:path";
import { z } from "zod";
import { fileExists, readJsonFile } from "../utils/fs.js";
import {
  defaultProjectConfig,
  type HtmlOutputConfig,
  type LoadedProjectConfig,
  type OutputConfig,
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
      html: htmlOutputConfigSchema.optional(),
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

  if (config.output?.html) {
    normalizedOutput = {
      html: normalizeHtmlOutputConfig(config.output.html),
    };
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
  };
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
