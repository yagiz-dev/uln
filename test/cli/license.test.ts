import { describe, expect, it } from "vitest";
import { readBundledLicense } from "../../src/cli/commands/license.js";

describe("readBundledLicense", () => {
  it("reads the bundled LICENSE file", async () => {
    await expect(readBundledLicense()).resolves.toContain("MIT License");
  });
});
