import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverManagers } from "../../src/core/discover-managers.js";

describe("discoverManagers", () => {
  it("marks npm projects as supported and warns when the lockfile is missing", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "uln-discovery-"));

    try {
      await writeFile(join(projectRoot, "package.json"), "{}", "utf8");

      await expect(discoverManagers(projectRoot)).resolves.toEqual([
        {
          packageManager: "npm",
          status: "supported",
          projectRoot,
          manifests: [{ kind: "manifest", path: "package.json" }],
          notes: [
            {
              level: "warning",
              message:
                "Found package.json without package-lock.json; notice generation will be incomplete.",
            },
          ],
        },
      ]);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("marks composer projects as supported when manifests are present", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "uln-discovery-"));

    try {
      await writeFile(join(projectRoot, "composer.json"), "{}", "utf8");
      await writeFile(join(projectRoot, "composer.lock"), "{}", "utf8");

      await expect(discoverManagers(projectRoot)).resolves.toEqual([
        {
          packageManager: "composer",
          status: "supported",
          projectRoot,
          manifests: [
            { kind: "manifest", path: "composer.json" },
            { kind: "lockfile", path: "composer.lock" },
          ],
          notes: [],
        },
      ]);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});
