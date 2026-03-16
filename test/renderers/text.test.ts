import { describe, expect, it } from "vitest";
import { renderText } from "../../src/renderers/text.js";

describe("renderText", () => {
  it("renders an empty scan result list", () => {
    expect(renderText([])).toBe("No supported package managers detected in the current project root.");
  });
});
