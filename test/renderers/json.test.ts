import { describe, expect, it } from "vitest";
import { renderJson } from "../../src/renderers/json.js";

describe("renderJson", () => {
  it("renders complete JSON output by default", () => {
    const output = renderJson([
      {
        packageManager: "npm",
        warnings: [],
        dependencies: [
          {
            packageManager: "npm",
            name: "chalk",
            version: "5.4.1",
            direct: true,
            repository: "https://github.com/chalk/chalk",
            warnings: [],
          },
        ],
      },
    ]);

    const parsed = JSON.parse(output) as Array<{
      dependencies: Array<{ version?: string; repository?: string }>;
    }>;

    expect(parsed[0]?.dependencies[0]?.version).toBe("5.4.1");
    expect(parsed[0]?.dependencies[0]?.repository).toBe("https://github.com/chalk/chalk");
  });

  it("hides configured fields from JSON output", () => {
    const output = renderJson(
      [
        {
          packageManager: "npm",
          warnings: [],
          dependencies: [
            {
              packageManager: "npm",
              name: "chalk",
              version: "5.4.1",
              direct: true,
              homepage: "https://example.com",
              repository: "https://github.com/chalk/chalk",
              warnings: [],
            },
          ],
        },
      ],
      {
        hideFields: ["version", "homepage", "repository"],
      },
    );

    const parsed = JSON.parse(output) as Array<{
      dependencies: Array<Record<string, unknown>>;
    }>;

    expect(parsed[0]?.dependencies[0]).not.toHaveProperty("version");
    expect(parsed[0]?.dependencies[0]).not.toHaveProperty("homepage");
    expect(parsed[0]?.dependencies[0]).not.toHaveProperty("repository");
  });
});
