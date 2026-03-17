import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderHtml } from "../../src/renderers/html.js";

describe("renderHtml", () => {
  it("renders an empty scan result list", () => {
    const output = renderHtml([], {
      generatedAt: new Date("2025-01-01T00:00:00.000Z"),
    });

    expect(output).toContain("Third-Party Notices");
    expect(output).toContain("Generated using");
    expect(output).toContain("Universal License Notice");
    expect(output).toContain("from discovered package metadata.");
    expect(output).toContain("No supported package managers detected in the current project root.");
  });

  it("renders collapsible dependency sections and license text", () => {
    const output = renderHtml(
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
              licenseExpression: "MIT",
              homepage: "https://github.com/chalk/chalk",
              repository: "https://github.com/chalk/chalk",
              author: "Chalk Team",
              licenseText: "MIT License",
              warnings: [],
            },
          ],
        },
      ],
      {
        generatedAt: new Date("2025-01-01T00:00:00.000Z"),
      },
    );

    expect(output).toContain('<details class="manager-section" open>');
    expect(output).toContain("<summary>npm</summary>");
    expect(output).toContain('<details class="dependency-section">');
    expect(output).toContain("<summary>chalk@5.4.1 (MIT)</summary>");
    expect(output).toContain("<strong>Author:</strong> Chalk Team");
    expect(output).toContain("<pre>MIT License</pre>");
  });

  it("escapes HTML in dynamic content", () => {
    const output = renderHtml(
      [
        {
          packageManager: "npm",
          warnings: [],
          dependencies: [
            {
              packageManager: "npm",
              name: "<pkg>",
              version: "1.0.0",
              direct: false,
              licenseExpression: "MIT",
              author: "<author>",
              repository: "https://example.com/?q=<script>",
              licenseText: "<license>",
              warnings: [],
            },
          ],
        },
      ],
      {
        generatedAt: new Date("2025-01-01T00:00:00.000Z"),
      },
    );

    expect(output).toContain("&lt;pkg&gt;@1.0.0 (MIT)");
    expect(output).toContain("&lt;author&gt;");
    expect(output).toContain("&lt;license&gt;");
    expect(output).not.toContain("<script>");
  });

  it("renders a custom EJS template file", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "uln-html-template-"));
    const templatePath = join(tempDirectory, "notice.ejs");

    try {
      await writeFile(templatePath, "<h1><%= title %></h1><p><%= results.length %></p>");

      const output = renderHtml([], {
        title: "Custom Notice",
        templatePath,
        generatedAt: new Date("2025-01-01T00:00:00.000Z"),
      });

      expect(output).toContain("<h1>Custom Notice</h1>");
      expect(output).toContain("<p>0</p>");
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("renders description as HTML in the default template", () => {
    const output = renderHtml([], {
      description: 'Generated using <a href="https://example.com">Example</a> <em>tooling</em>.',
      generatedAt: new Date("2025-01-01T00:00:00.000Z"),
    });

    expect(output).toContain('<a href="https://example.com">Example</a>');
    expect(output).toContain("<em>tooling</em>");
    expect(output).not.toContain("&lt;a href");
  });

  it("hides configured fields from html output", () => {
    const output = renderHtml(
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
              licenseExpression: "MIT",
              homepage: "https://github.com/chalk/chalk",
              repository: "https://github.com/chalk/chalk",
              author: "Chalk Team",
              warnings: [],
            },
          ],
        },
      ],
      {
        hideFields: ["version", "homepage", "repository", "licenseExpression"],
        generatedAt: new Date("2025-01-01T00:00:00.000Z"),
      },
    );

    expect(output).toContain("<summary>chalk</summary>");
    expect(output).not.toContain("<strong>Homepage:</strong>");
    expect(output).not.toContain("<strong>Repository:</strong>");
  });
});
