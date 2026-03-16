import type { Warning } from "../types/dependency.js";
import { sortWarnings } from "../utils/sort.js";

export function mergeWarnings(warnings: Warning[]): Warning[] {
  const seen = new Set<string>();
  const merged: Warning[] = [];

  for (const warning of warnings) {
    const key = `${warning.code}:${warning.packageName ?? ""}:${warning.message}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(warning);
  }

  return sortWarnings(merged);
}
