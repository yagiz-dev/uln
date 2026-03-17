import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG_FILE_NAME, loadProjectConfig } from "../../src/config/load.js";

describe("loadProjectConfig", () => {
  it("returns defaults when no config file is present", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "uln-config-"));

    try {
      await expect(loadProjectConfig(projectRoot)).resolves.toEqual({
        config: {
          managers: {},
        },
      });
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("loads the default config file when present", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "uln-config-"));
    const configPath = join(projectRoot, DEFAULT_CONFIG_FILE_NAME);

    try {
      await writeFile(
        configPath,
        JSON.stringify({
          managers: {
            npm: {
              excludePackages: ["left-pad", "left-pad"],
              packageOverrides: {
                chalk: {
                  licenseExpression: "MIT",
                },
              },
            },
            composer: {
              excludePackages: ["vendor/package", "vendor/package"],
              packageOverrides: {
                "vendor/other": {
                  licenseExpression: "MIT",
                },
              },
            },
          },
        }),
      );

      await expect(loadProjectConfig(projectRoot)).resolves.toEqual({
        path: configPath,
        config: {
          managers: {
            npm: {
              excludePackages: ["left-pad"],
              packageOverrides: {
                chalk: {
                  licenseExpression: "MIT",
                },
              },
            },
            composer: {
              excludePackages: ["vendor/package"],
              packageOverrides: {
                "vendor/other": {
                  licenseExpression: "MIT",
                },
              },
            },
          },
        },
      });
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("throws when an explicit config path does not exist", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "uln-config-"));

    try {
      await expect(loadProjectConfig(projectRoot, "missing.config.json")).rejects.toThrow(
        "Configuration file not found:",
      );
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("loads output html config values", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "uln-config-"));
    const configPath = join(projectRoot, DEFAULT_CONFIG_FILE_NAME);

    try {
      await writeFile(
        configPath,
        JSON.stringify({
          output: {
            html: {
              title: "My Notices",
              description: "Generated notice",
              templatePath: "templates/notice.ejs",
            },
          },
        }),
      );

      await expect(loadProjectConfig(projectRoot)).resolves.toEqual({
        path: configPath,
        config: {
          managers: {},
          output: {
            html: {
              title: "My Notices",
              description: "Generated notice",
              templatePath: "templates/notice.ejs",
            },
          },
        },
      });
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("loads and deduplicates global and per-format hideFields", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "uln-config-"));
    const configPath = join(projectRoot, DEFAULT_CONFIG_FILE_NAME);

    try {
      await writeFile(
        configPath,
        JSON.stringify({
          output: {
            hideFields: ["repository", "repository", "homepage"],
            html: {
              hideFields: ["author", "homepage", "author"],
            },
            text: {
              hideFields: ["version", "version"],
            },
            json: {
              hideFields: ["licenseText", "licenseSourcePath", "licenseText"],
            },
          },
        }),
      );

      await expect(loadProjectConfig(projectRoot)).resolves.toEqual({
        path: configPath,
        config: {
          managers: {},
          output: {
            hideFields: ["repository", "homepage"],
            html: {
              hideFields: ["author", "homepage"],
            },
            text: {
              hideFields: ["version"],
            },
            json: {
              hideFields: ["licenseText", "licenseSourcePath"],
            },
          },
        },
      });
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("throws for unsupported hideFields values", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "uln-config-"));
    const configPath = join(projectRoot, DEFAULT_CONFIG_FILE_NAME);

    try {
      await writeFile(
        configPath,
        JSON.stringify({
          output: {
            hideFields: ["packageName"],
          },
        }),
      );

      await expect(loadProjectConfig(projectRoot)).rejects.toThrow();
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});
