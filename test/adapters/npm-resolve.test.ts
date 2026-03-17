import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { WARNING_CODES } from "../../src/core/warning-codes.js";
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

  it("normalizes common license variants and suppresses file-reference warnings by default", async () => {
    const fixturePath = resolve("test/fixtures/npm-license-normalization");
    const result = await resolveNpmProject(fixturePath);
    const apacheStyle = result.dependencies.find(
      (dependency) => dependency.name === "apache-style",
    );
    const fileRef = result.dependencies.find((dependency) => dependency.name === "file-ref");

    expect(apacheStyle?.licenseExpression).toBe("Apache-2.0");
    expect(apacheStyle?.warnings).toEqual([]);
    expect(fileRef?.licenseExpression).toBe("SEE LICENSE IN LICENSE.md");
    expect(fileRef?.warnings).toEqual([]);
  });

  it("emits file-reference warnings when license text bundling is disabled", async () => {
    const fixturePath = resolve("test/fixtures/npm-license-normalization");
    const result = await resolveNpmProject(fixturePath, {
      includeLicenseText: false,
    });
    const fileRef = result.dependencies.find((dependency) => dependency.name === "file-ref");

    expect(fileRef?.warnings).toEqual([
      expect.objectContaining({
        code: WARNING_CODES.licenseFileReference,
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

  it("bundles local license text by default when package files are available", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "uln-npm-license-text-"));

    try {
      await writeFile(
        join(projectRoot, "package-lock.json"),
        JSON.stringify(
          {
            lockfileVersion: 3,
            packages: {
              "": {
                name: "fixture",
                version: "1.0.0",
              },
              "node_modules/licenseful": {
                version: "1.2.3",
                license: "MIT",
              },
            },
          },
          null,
          2,
        ),
        "utf8",
      );
      await mkdir(join(projectRoot, "node_modules", "licenseful"), {
        recursive: true,
      });
      await writeFile(
        join(projectRoot, "node_modules", "licenseful", "LICENSE"),
        "MIT License\n\nCopyright 2026",
        { encoding: "utf8", flag: "w" },
      );

      const result = await resolveNpmProject(projectRoot);

      expect(result.dependencies[0]).toEqual(
        expect.objectContaining({
          name: "licenseful",
          licenseText: "MIT License\n\nCopyright 2026",
          licenseSourcePath: "node_modules/licenseful/LICENSE",
        }),
      );
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("bundles license files that use common variant names", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "uln-npm-license-variants-"));

    try {
      await writeFile(
        join(projectRoot, "package-lock.json"),
        JSON.stringify(
          {
            lockfileVersion: 3,
            packages: {
              "": {
                name: "fixture",
                version: "1.0.0",
              },
              "node_modules/variant-license-package": {
                version: "1.2.3",
                license: "MIT",
              },
            },
          },
          null,
          2,
        ),
        "utf8",
      );
      await mkdir(join(projectRoot, "node_modules", "variant-license-package"), {
        recursive: true,
      });
      await writeFile(
        join(projectRoot, "node_modules", "variant-license-package", "LICENSE-MIT.txt"),
        "MIT License variant",
        { encoding: "utf8", flag: "w" },
      );

      const result = await resolveNpmProject(projectRoot);
      const dependency = result.dependencies[0];

      expect(dependency).toEqual(
        expect.objectContaining({
          name: "variant-license-package",
          licenseText: "MIT License variant",
          licenseSourcePath: "node_modules/variant-license-package/LICENSE-MIT.txt",
        }),
      );
      expect(dependency?.warnings).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "license_file_missing" })]),
      );
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("falls back to legacy package.json licenses when lockfile license is missing", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "uln-npm-legacy-license-field-"));

    try {
      await writeFile(
        join(projectRoot, "package-lock.json"),
        JSON.stringify(
          {
            lockfileVersion: 3,
            packages: {
              "": {
                name: "fixture",
                version: "1.0.0",
              },
              "node_modules/legacy-license-package": {
                version: "1.2.3",
              },
            },
          },
          null,
          2,
        ),
        "utf8",
      );
      await mkdir(join(projectRoot, "node_modules", "legacy-license-package"), {
        recursive: true,
      });
      await writeFile(
        join(projectRoot, "node_modules", "legacy-license-package", "package.json"),
        JSON.stringify(
          {
            name: "legacy-license-package",
            version: "1.2.3",
            licenses: [{ type: "MIT" }],
          },
          null,
          2,
        ),
        { encoding: "utf8", flag: "w" },
      );

      const result = await resolveNpmProject(projectRoot);
      const dependency = result.dependencies[0];

      expect(dependency?.licenseExpression).toBe("MIT");
      expect(dependency?.warnings).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "license_missing" })]),
      );
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("skips bundling when --dont-include-license-text is enabled", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "uln-npm-license-text-"));

    try {
      await writeFile(
        join(projectRoot, "package-lock.json"),
        JSON.stringify(
          {
            lockfileVersion: 3,
            packages: {
              "": {
                name: "fixture",
                version: "1.0.0",
              },
              "node_modules/licenseful": {
                version: "1.2.3",
                license: "MIT",
              },
            },
          },
          null,
          2,
        ),
        "utf8",
      );
      await mkdir(join(projectRoot, "node_modules", "licenseful"), {
        recursive: true,
      });
      await writeFile(
        join(projectRoot, "node_modules", "licenseful", "LICENSE"),
        "MIT License\n\nCopyright 2026",
        { encoding: "utf8", flag: "w" },
      );

      const result = await resolveNpmProject(projectRoot, {
        includeLicenseText: false,
      });

      expect(result.dependencies[0]?.licenseText).toBeUndefined();
      expect(result.dependencies[0]?.licenseSourcePath).toBeUndefined();
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});
