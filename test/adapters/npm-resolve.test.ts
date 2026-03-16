import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveNpmProject } from "../../src/adapters/npm/resolve.js";

describe("resolveNpmProject", () => {
  it("reads dependencies from a modern package-lock.json", async () => {
    const fixturePath = resolve("test/fixtures/npm-basic");
    const result = await resolveNpmProject(fixturePath);

    expect(result.packageManager).toBe("npm");
    expect(result.dependencies).toHaveLength(2);
    expect(result.dependencies).toEqual([
      expect.objectContaining({
        name: "chalk",
        version: "5.4.1",
        direct: true,
        licenseExpression: "MIT",
      }),
      expect.objectContaining({
        name: "left-pad",
        version: "1.3.0",
        direct: true,
        licenseExpression: "WTFPL",
      }),
    ]);
  });

  it("emits dependency warnings when license metadata is missing", async () => {
    const fixturePath = resolve("test/fixtures/npm-missing-license");
    const result = await resolveNpmProject(fixturePath);

    expect(result.dependencies[0]).toEqual(
      expect.objectContaining({
        name: "mystery-package",
      }),
    );
    expect(result.dependencies[0]?.warnings).toEqual([
      expect.objectContaining({
        code: "license_missing",
      }),
    ]);
  });

  it("normalizes common license variants and warns on file references", async () => {
    const fixturePath = resolve("test/fixtures/npm-license-normalization");
    const result = await resolveNpmProject(fixturePath);
    const apacheStyle = result.dependencies.find(
      (dependency) => dependency.name === "apache-style",
    );
    const fileRef = result.dependencies.find(
      (dependency) => dependency.name === "file-ref",
    );

    expect(apacheStyle?.licenseExpression).toBe("Apache-2.0");
    expect(apacheStyle?.warnings).toEqual([]);
    expect(fileRef?.licenseExpression).toBe("SEE LICENSE IN LICENSE.md");
    expect(fileRef?.warnings).toEqual([
      expect.objectContaining({
        code: "license_normalization_warning",
      }),
    ]);
  });

  it("falls back to package.json when package-lock.json is missing", async () => {
    const fixturePath = resolve("test/fixtures/npm-no-lockfile");
    const result = await resolveNpmProject(fixturePath);

    expect(result.dependencies).toEqual([
      expect.objectContaining({
        name: "left-pad",
        version: "unknown",
        direct: true,
      }),
    ]);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: "npm_lockfile_missing",
      }),
    ]);
  });

  it("marks workspace dependencies as direct and normalizes nested package names", async () => {
    const fixturePath = resolve("test/fixtures/npm-workspaces");
    const result = await resolveNpmProject(fixturePath);

    expect(result.dependencies).toHaveLength(3);
    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "left-pad",
          direct: true,
        }),
        expect.objectContaining({
          name: "nested",
          direct: false,
        }),
        expect.objectContaining({
          name: "parent",
          direct: true,
        }),
      ]),
    );
  });
});
