import { describe, expect, it } from "vitest";
import {
  shouldIncludeLicenseText,
  shouldWriteToStdout,
  validateGenerateCommandOptions,
} from "../../src/cli/commands/generate.js";

describe("shouldWriteToStdout", () => {
  it("returns true when --stdout is enabled", () => {
    expect(shouldWriteToStdout({ format: "text", stdout: true })).toBe(true);
  });

  it("returns false when writing to a file", () => {
    expect(shouldWriteToStdout({ format: "json", output: "NOTICE.json" })).toBe(false);
  });
});

describe("shouldIncludeLicenseText", () => {
  it("defaults to including bundled license text", () => {
    expect(shouldIncludeLicenseText({ format: "text" })).toBe(true);
  });

  it("disables bundled license text when opted out", () => {
    expect(
      shouldIncludeLicenseText({
        format: "text",
        dontIncludeLicenseText: true,
      }),
    ).toBe(false);
  });
});

describe("validateGenerateCommandOptions", () => {
  it("allows stdout on its own", () => {
    expect(() => validateGenerateCommandOptions({ format: "text", stdout: true })).not.toThrow();
  });

  it("rejects stdout and output together", () => {
    expect(() =>
      validateGenerateCommandOptions({
        format: "json",
        stdout: true,
        output: "NOTICE.json",
      }),
    ).toThrow("The --stdout and --output options cannot be used together.");
  });

  it("rejects unsupported output formats", () => {
    expect(() =>
      validateGenerateCommandOptions({
        format: "yaml",
      }),
    ).toThrow('Unsupported output format "yaml". Use "text" or "json".');
  });
});
