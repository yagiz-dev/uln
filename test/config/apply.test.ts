import { describe, expect, it } from "vitest";
import { applyProjectConfig } from "../../src/config/apply.js";
import type { ScanResult } from "../../src/types/dependency.js";

describe("applyProjectConfig", () => {
  it("excludes packages and applies metadata overrides", () => {
    const results: ScanResult[] = [
      {
        packageManager: "npm",
        warnings: [],
        dependencies: [
          {
            packageManager: "npm",
            name: "chalk",
            version: "5.4.1",
            direct: true,
            licenseExpression: "SEE LICENSE IN LICENSE.md",
            homepage: undefined,
            repository: undefined,
            author: undefined,
            warnings: [
              {
                code: "license_file_reference",
                packageName: "chalk",
              },
            ],
          },
          {
            packageManager: "npm",
            name: "left-pad",
            version: "1.3.0",
            direct: true,
            warnings: [],
          },
        ],
      },
    ];

    const configured = applyProjectConfig(results, {
      managers: {
        npm: {
          excludePackages: ["left-pad"],
          packageOverrides: {
            chalk: {
              licenseExpression: "MIT",
              repository: "https://github.com/chalk/chalk",
            },
          },
        },
      },
    });

    expect(configured[0]?.dependencies).toEqual([
      expect.objectContaining({
        name: "chalk",
        licenseExpression: "MIT",
        repository: "https://github.com/chalk/chalk",
        warnings: [],
      }),
    ]);
  });

  it("supports excluding packages through package overrides", () => {
    const results: ScanResult[] = [
      {
        packageManager: "npm",
        warnings: [],
        dependencies: [
          {
            packageManager: "npm",
            name: "chalk",
            version: "5.4.1",
            direct: true,
            warnings: [],
          },
        ],
      },
    ];

    const configured = applyProjectConfig(results, {
      managers: {
        npm: {
          excludePackages: [],
          packageOverrides: {
            chalk: {
              exclude: true,
            },
          },
        },
      },
    });

    expect(configured[0]?.dependencies).toEqual([]);
  });

  it("supports wildcard exclusions and wildcard overrides", () => {
    const results: ScanResult[] = [
      {
        packageManager: "npm",
        warnings: [],
        dependencies: [
          {
            packageManager: "npm",
            name: "@ckeditor/core",
            version: "1.0.0",
            direct: true,
            warnings: [],
          },
          {
            packageManager: "npm",
            name: "@ckeditor/theme",
            version: "1.0.0",
            direct: true,
            warnings: [],
          },
          {
            packageManager: "npm",
            name: "@scope/pkg",
            version: "1.0.0",
            direct: true,
            warnings: [
              {
                code: "license_missing",
                details: { reason: "missing_from_lockfile" },
                packageName: "@scope/pkg",
              },
            ],
          },
        ],
      },
    ];

    const configured = applyProjectConfig(results, {
      managers: {
        npm: {
          excludePackages: ["@ckeditor/*"],
          packageOverrides: {
            "@scope/*": {
              licenseExpression: "MIT",
            },
          },
        },
      },
    });

    expect(configured[0]?.dependencies).toEqual([
      expect.objectContaining({
        name: "@scope/pkg",
        licenseExpression: "MIT",
        warnings: [],
      }),
    ]);
  });

  it("prefers exact overrides over wildcard overrides", () => {
    const results: ScanResult[] = [
      {
        packageManager: "npm",
        warnings: [],
        dependencies: [
          {
            packageManager: "npm",
            name: "@scope/pkg",
            version: "1.0.0",
            direct: true,
            warnings: [],
          },
        ],
      },
    ];

    const configured = applyProjectConfig(results, {
      managers: {
        npm: {
          excludePackages: [],
          packageOverrides: {
            "@scope/*": {
              licenseExpression: "Apache-2.0",
            },
            "@scope/pkg": {
              licenseExpression: "MIT",
            },
          },
        },
      },
    });

    expect(configured[0]?.dependencies).toEqual([
      expect.objectContaining({
        name: "@scope/pkg",
        licenseExpression: "MIT",
      }),
    ]);
  });
});
