import { cwd } from "node:process";
import { describe, expect, it } from "vitest";
import { renderScanReport } from "../../src/renderers/scan.js";

describe("renderScanReport", () => {
  it("renders an empty discovery list", () => {
    expect(renderScanReport([])).toBe("No supported package manifests found in the current project root.");
  });

  it("renders manifest locations and notes", () => {
    const output = renderScanReport([
      {
        packageManager: "npm",
        status: "supported",
        projectRoot: cwd(),
        manifests: [
          { kind: "manifest", path: "package.json" },
          { kind: "lockfile", path: "package-lock.json" },
        ],
        notes: [{ level: "warning", message: "Lockfile is missing." }],
      },
    ]);

    expect(output).toContain("Package manager | Support   | Manifest files");
    expect(output).toContain("npm             | supported | package.json, package-lock.json");
    expect(output).toContain("Notes:\n- npm (warning): Lockfile is missing.");
  });

  it("renders unsupported package managers in the same table", () => {
    const output = renderScanReport([
      {
        packageManager: "composer",
        status: "unsupported",
        projectRoot: cwd(),
        manifests: [
          { kind: "manifest", path: "composer.json" },
          { kind: "lockfile", path: "composer.lock" },
        ],
        notes: [{ level: "info", message: "composer manifests were found, but this adapter has not been implemented yet." }],
      },
    ]);

    expect(output).toContain("composer        | unsupported | composer.json, composer.lock");
    expect(output).toContain("- composer (info): composer manifests were found, but this adapter has not been implemented yet.");
  });
});
