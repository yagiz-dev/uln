import { Command } from "commander";
import { describe, expect, it } from "vitest";
import {
  collectGenerateWarnings,
  registerGenerateCommand,
  shouldIncludeDevDependencies,
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

describe("shouldIncludeDevDependencies", () => {
  it("defaults to including development dependencies", () => {
    expect(shouldIncludeDevDependencies({ format: "text" })).toBe(true);
  });

  it("excludes development dependencies when opted in", () => {
    expect(
      shouldIncludeDevDependencies({
        format: "text",
        excludeDev: true,
      }),
    ).toBe(false);
  });
});

describe("validateGenerateCommandOptions", () => {
  it("allows stdout on its own", () => {
    expect(() => validateGenerateCommandOptions({ format: "text", stdout: true })).not.toThrow();
  });

  it("accepts html as an output format", () => {
    expect(() => validateGenerateCommandOptions({ format: "html" })).not.toThrow();
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
    ).toThrow('Unsupported output format "yaml". Use "html", "text", or "json".');
  });
});

describe("collectGenerateWarnings", () => {
  it("collects package manager and dependency warnings", () => {
    const warnings = collectGenerateWarnings([
      {
        packageManager: "npm",
        warnings: [{ code: "npm_lockfile_missing" }],
        dependencies: [
          {
            packageManager: "npm",
            name: "left-pad",
            version: "1.3.0",
            direct: true,
            warnings: [{ code: "license_missing", details: { reason: "missing_from_lockfile" } }],
          },
        ],
      },
    ]);

    expect(warnings).toEqual([
      "npm package-lock.json is missing; results only include direct dependencies declared in package.json.",
      "npm:left-pad License metadata is missing from the lockfile.",
    ]);
  });

  it("deduplicates warning lines", () => {
    const warnings = collectGenerateWarnings([
      {
        packageManager: "npm",
        warnings: [{ code: "npm_lockfile_missing" }],
        dependencies: [
          {
            packageManager: "npm",
            name: "left-pad",
            version: "1.3.0",
            direct: true,
            warnings: [
              { code: "license_missing", details: { reason: "missing_from_lockfile" } },
              { code: "license_missing", details: { reason: "missing_from_lockfile" } },
            ],
          },
        ],
      },
      {
        packageManager: "npm",
        warnings: [{ code: "npm_lockfile_missing" }],
        dependencies: [],
      },
    ]);

    expect(warnings).toEqual([
      "npm package-lock.json is missing; results only include direct dependencies declared in package.json.",
      "npm:left-pad License metadata is missing from the lockfile.",
    ]);
  });
});

describe("registerGenerateCommand", () => {
  it("defaults --format to html", () => {
    const program = new Command();
    registerGenerateCommand(program);

    const generateCommand = program.commands.find((command) => command.name() === "generate");
    const formatOption = generateCommand?.options.find((option) => option.long === "--format");

    expect(formatOption?.defaultValue).toBe("html");
  });

  it("registers --exclude-dev option", () => {
    const program = new Command();
    registerGenerateCommand(program);

    const generateCommand = program.commands.find((command) => command.name() === "generate");
    const excludeDevOption = generateCommand?.options.find(
      (option) => option.long === "--exclude-dev",
    );

    expect(excludeDevOption).toBeDefined();
  });
});
