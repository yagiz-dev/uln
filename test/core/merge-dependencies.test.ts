import { describe, expect, it } from "vitest";
import { mergeDependencies } from "../../src/core/merge-dependencies.js";
import type { NormalizedDependency } from "../../src/types/dependency.js";

describe("mergeDependencies", () => {
  it("merges duplicate package entries and keeps the most complete metadata", () => {
    const dependencies: NormalizedDependency[] = [
      {
        packageManager: "npm",
        name: "chalk",
        version: "5.4.1",
        direct: false,
        warnings: [
          {
            code: "repository_missing",
            packageName: "chalk",
          },
        ],
      },
      {
        packageManager: "npm",
        name: "chalk",
        version: "5.4.1",
        direct: true,
        licenseExpression: "MIT",
        homepage: "https://github.com/chalk/chalk",
        author: "Sindre Sorhus",
        warnings: [
          {
            code: "license_missing",
            details: { reason: "missing_from_lockfile" },
            packageName: "chalk",
          },
        ],
      },
    ];

    expect(mergeDependencies(dependencies)).toEqual([
      {
        packageManager: "npm",
        name: "chalk",
        version: "5.4.1",
        direct: true,
        licenseExpression: "MIT",
        homepage: "https://github.com/chalk/chalk",
        repository: undefined,
        author: "Sindre Sorhus",
        warnings: [
          {
            code: "license_missing",
            details: { reason: "missing_from_lockfile" },
            packageName: "chalk",
          },
          {
            code: "repository_missing",
            packageName: "chalk",
          },
        ],
      },
    ]);
  });

  it("returns dependencies sorted by package name and version", () => {
    const dependencies: NormalizedDependency[] = [
      {
        packageManager: "npm",
        name: "zod",
        version: "3.24.2",
        direct: true,
        warnings: [],
      },
      {
        packageManager: "npm",
        name: "chalk",
        version: "5.4.1",
        direct: true,
        warnings: [],
      },
      {
        packageManager: "npm",
        name: "chalk",
        version: "4.1.2",
        direct: true,
        warnings: [],
      },
    ];

    expect(mergeDependencies(dependencies).map(({ name, version }) => ({ name, version }))).toEqual(
      [
        { name: "chalk", version: "4.1.2" },
        { name: "chalk", version: "5.4.1" },
        { name: "zod", version: "3.24.2" },
      ],
    );
  });
});
