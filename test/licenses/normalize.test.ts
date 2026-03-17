import { describe, expect, it } from "vitest";
import { WARNING_MESSAGES } from "../../src/core/warning-messages.js";
import { normalizeLicenseField, normalizeLicenseValue } from "../../src/licenses/normalize.js";

describe("normalizeLicenseValue", () => {
  it("normalizes common Apache variants", () => {
    expect(normalizeLicenseValue("Apache License 2.0")).toEqual({
      normalizedExpression: "Apache-2.0",
      warnings: [],
    });
  });

  it("preserves file reference licenses and warns", () => {
    expect(normalizeLicenseValue("SEE LICENSE IN LICENSE.md")).toEqual({
      normalizedExpression: "SEE LICENSE IN LICENSE.md",
      warnings: [WARNING_MESSAGES.licenseFileReference],
    });
  });

  it("normalizes slash-delimited expressions to OR", () => {
    expect(normalizeLicenseValue("MIT/Apache 2.0")).toEqual({
      normalizedExpression: "MIT OR Apache-2.0",
      warnings: [],
    });
  });

  it("normalizes CC0 and Unlicense SPDX identifiers", () => {
    expect(normalizeLicenseValue("CC0-1.0")).toEqual({
      normalizedExpression: "CC0-1.0",
      warnings: [],
    });

    expect(normalizeLicenseValue("Unlicense")).toEqual({
      normalizedExpression: "Unlicense",
      warnings: [],
    });
  });

  it("accepts valid SPDX expressions with mixed operator casing", () => {
    expect(normalizeLicenseValue("MIT or Apache-2.0")).toEqual({
      normalizedExpression: "MIT OR Apache-2.0",
      warnings: [],
    });
  });

  it("applies heuristic SPDX correction when value is close", () => {
    expect(normalizeLicenseValue("BSD")).toEqual({
      normalizedExpression: "BSD-2-Clause",
      warnings: [WARNING_MESSAGES.licenseHeuristicallyNormalized("BSD-2-Clause")],
    });
  });
});

describe("normalizeLicenseField", () => {
  it("joins array licenses as OR", () => {
    expect(normalizeLicenseField(["MIT", "BSD 3-Clause"])).toEqual({
      normalizedExpression: "MIT OR BSD-3-Clause",
      warnings: [],
    });
  });
});
