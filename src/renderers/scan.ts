import type { ProjectDiscovery } from "../types/discovery.js";

function padCell(value: string, width: number): string {
  return value.padEnd(width, " ");
}

function renderTable(discoveries: ProjectDiscovery[]): string {
  const headers = ["Package manager", "Support", "Manifest files"];
  const rows = discoveries.map((discovery) => [
    discovery.packageManager,
    discovery.status,
    discovery.manifests.map((manifest) => manifest.path).join(", "),
  ]);

  const widths = headers.map((header, index) => {
    const rowWidths = rows.map((row) => row[index]?.length ?? 0);
    return Math.max(header.length, ...rowWidths);
  });

  const divider = widths.map((width) => "-".repeat(width)).join("-+-");
  const headerRow = headers.map((header, index) => padCell(header, widths[index] ?? header.length)).join(" | ");
  const bodyRows = rows.map((row) => row.map((cell, index) => padCell(cell, widths[index] ?? cell.length)).join(" | "));

  return [headerRow, divider, ...bodyRows].join("\n");
}

export function renderScanReport(discoveries: ProjectDiscovery[]): string {
  if (discoveries.length === 0) {
    return "No supported package manifests found in the current project root.";
  }

  const lines = [
    `Project root: ${discoveries[0]?.projectRoot ?? "unknown"}`,
    "",
    renderTable(discoveries),
  ];

  const notes = discoveries.flatMap((discovery) =>
    discovery.notes.map((note) => `- ${discovery.packageManager} (${note.level}): ${note.message}`),
  );

  if (notes.length > 0) {
    lines.push("", "Notes:", ...notes);
  }

  return lines.join("\n");
}
