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
});
