import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { WARNING_CODES } from "../../src/core/warning-codes.js";
import { resolveComposerProject } from "../../src/adapters/composer/resolve.js";

describe("resolveComposerProject", () => {
  it("reads dependencies from composer.lock including packages-dev", async () => {
    const fixturePath = resolve("test/fixtures/composer-basic");
    const result = await resolveComposerProject(fixturePath);

    expect(result.packageManager).toBe("composer");
    expect(result.dependencies).toHaveLength(2);
    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "monolog/monolog",
          version: "3.7.0",
          direct: true,
          licenseExpression: "MIT",
        }),
        expect.objectContaining({
          name: "phpunit/phpunit",
          version: "10.5.46",
          direct: true,
          licenseExpression: "BSD-3-Clause",
        }),
      ]),
    );
  });

  it("emits dependency warnings when license metadata is missing", async () => {
    const fixturePath = resolve("test/fixtures/composer-missing-license");
    const result = await resolveComposerProject(fixturePath);

    expect(result.dependencies[0]).toEqual(
      expect.objectContaining({
        name: "mystery/package",
      }),
    );
    expect(result.dependencies[0]?.warnings).toEqual([
      expect.objectContaining({
        code: "license_missing",
      }),
    ]);
  });

  it("falls back to composer.json when composer.lock is missing", async () => {
    const fixturePath = resolve("test/fixtures/composer-no-lockfile");
    const result = await resolveComposerProject(fixturePath);

    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "phpunit/phpunit",
          version: "unknown",
          direct: true,
        }),
        expect.objectContaining({
          name: "symfony/console",
          version: "unknown",
          direct: true,
        }),
      ]),
    );
    expect(result.dependencies).toHaveLength(2);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: "composer_lockfile_missing",
      }),
    ]);
  });

  it("bundles local license text by default when vendor package files are available", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "uln-composer-license-text-"));

    try {
      await writeFile(
        join(projectRoot, "composer.lock"),
        JSON.stringify(
          {
            packages: [
              {
                name: "acme/licenseful",
                version: "1.2.3",
                license: "MIT",
              },
            ],
            "packages-dev": [],
          },
          null,
          2,
        ),
        "utf8",
      );
      await mkdir(join(projectRoot, "vendor", "acme", "licenseful"), {
        recursive: true,
      });
      await writeFile(
        join(projectRoot, "vendor", "acme", "licenseful", "LICENSE"),
        "MIT License\n\nCopyright 2026",
        { encoding: "utf8", flag: "w" },
      );

      const result = await resolveComposerProject(projectRoot);

      expect(result.dependencies[0]).toEqual(
        expect.objectContaining({
          name: "acme/licenseful",
          licenseText: "MIT License\n\nCopyright 2026",
          licenseSourcePath: "vendor/acme/licenseful/LICENSE",
        }),
      );
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("uses configured composer vendor-dir for license bundling", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "uln-composer-custom-vendor-dir-"));

    try {
      await writeFile(
        join(projectRoot, "composer.json"),
        JSON.stringify(
          {
            name: "acme/custom-vendor-dir",
            config: {
              "vendor-dir": "custom-vendor",
            },
          },
          null,
          2,
        ),
        "utf8",
      );
      await writeFile(
        join(projectRoot, "composer.lock"),
        JSON.stringify(
          {
            packages: [
              {
                name: "acme/licenseful",
                version: "1.2.3",
                license: "MIT",
              },
            ],
            "packages-dev": [],
          },
          null,
          2,
        ),
        "utf8",
      );
      await mkdir(join(projectRoot, "custom-vendor", "acme", "licenseful"), {
        recursive: true,
      });
      await writeFile(
        join(projectRoot, "custom-vendor", "acme", "licenseful", "LICENSE"),
        "MIT License from custom vendor dir",
        { encoding: "utf8", flag: "w" },
      );

      const result = await resolveComposerProject(projectRoot);

      expect(result.dependencies[0]).toEqual(
        expect.objectContaining({
          name: "acme/licenseful",
          licenseText: "MIT License from custom vendor dir",
          licenseSourcePath: "custom-vendor/acme/licenseful/LICENSE",
        }),
      );
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("falls back to installed composer package metadata when lockfile fields are missing", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "uln-composer-package-metadata-"));

    try {
      await writeFile(
        join(projectRoot, "composer.lock"),
        JSON.stringify(
          {
            packages: [
              {
                name: "acme/metadata-package",
                version: "1.2.3",
              },
            ],
            "packages-dev": [],
          },
          null,
          2,
        ),
        "utf8",
      );
      await mkdir(join(projectRoot, "vendor", "acme", "metadata-package"), {
        recursive: true,
      });
      await writeFile(
        join(projectRoot, "vendor", "acme", "metadata-package", "composer.json"),
        JSON.stringify(
          {
            name: "acme/metadata-package",
            version: "1.2.3",
            license: ["MIT"],
            homepage: "https://example.com/metadata-package",
            source: {
              type: "git",
              url: "https://github.com/example/metadata-package",
            },
            authors: [{ name: "Example Maintainer" }],
          },
          null,
          2,
        ),
        { encoding: "utf8", flag: "w" },
      );

      const result = await resolveComposerProject(projectRoot);
      const dependency = result.dependencies[0];

      expect(dependency).toEqual(
        expect.objectContaining({
          name: "acme/metadata-package",
          licenseExpression: "MIT",
          homepage: "https://example.com/metadata-package",
          repository: "https://github.com/example/metadata-package",
          author: "Example Maintainer",
        }),
      );
      expect(dependency?.warnings).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "license_missing" })]),
      );
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("emits file-reference warnings when license text bundling is disabled", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "uln-composer-file-ref-"));

    try {
      await writeFile(
        join(projectRoot, "composer.lock"),
        JSON.stringify(
          {
            packages: [
              {
                name: "acme/file-ref",
                version: "1.2.3",
                license: "SEE LICENSE IN LICENSE.md",
              },
            ],
            "packages-dev": [],
          },
          null,
          2,
        ),
        "utf8",
      );

      const result = await resolveComposerProject(projectRoot, {
        includeLicenseText: false,
      });
      const dependency = result.dependencies[0];

      expect(dependency?.warnings).toEqual([
        expect.objectContaining({
          code: WARNING_CODES.licenseFileReference,
        }),
      ]);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});
