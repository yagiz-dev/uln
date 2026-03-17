import { describe, expect, it } from "vitest";
import { renderText } from "../../src/renderers/text.js";

describe("renderText", () => {
  it("renders an empty scan result list", () => {
    expect(renderText([])).toBe(
      "No supported package managers detected in the current project root.",
    );
  });

  it("renders dependency metadata with result-level and dependency-level warnings", () => {
    expect(
      renderText([
        {
          packageManager: "npm",
          warnings: [{ code: "npm_lockfile_missing", message: "package-lock.json is missing." }],
          dependencies: [
            {
              packageManager: "npm",
              name: "chalk",
              version: "5.4.1",
              direct: true,
              warnings: [
                {
                  code: "license_normalization_warning",
                  message: "License uses a file reference instead of a normalized SPDX expression.",
                  packageName: "chalk",
                },
              ],
            },
          ],
        },
      ]),
    ).toBe(`Package manager: npm

Package: chalk
Version: 5.4.1
Direct: yes
License: Unknown
Repository: Unknown
Homepage: Unknown
Author: Unknown
Warnings:
- package-lock.json is missing.
- chalk: License uses a file reference instead of a normalized SPDX expression.`);
  });

  it("renders package managers with no dependencies", () => {
    expect(
      renderText([
        {
          packageManager: "npm",
          dependencies: [],
          warnings: [],
        },
      ]),
    ).toBe("Package manager: npm\nNo dependencies found.");
  });
});
