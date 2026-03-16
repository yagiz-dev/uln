import { describe, expect, it } from "vitest";
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
      warnings: ["License uses a file reference instead of a normalized SPDX expression."],
    });
  });

  it("normalizes slash-delimited expressions to OR", () => {
    expect(normalizeLicenseValue("MIT/Apache 2.0")).toEqual({
      normalizedExpression: "MIT OR Apache-2.0",
      warnings: [],
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
