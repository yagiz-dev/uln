import type { NormalizedDependency, Warning } from "../types/dependency.js";
import { getWarningMessage } from "../core/warning-codes.js";

export function sortDependencies(dependencies: NormalizedDependency[]): NormalizedDependency[] {
  return [...dependencies].sort((left, right) => {
    if (left.name !== right.name) {
      return left.name.localeCompare(right.name);
    }

    return left.version.localeCompare(right.version);
  });
}

export function sortWarnings(warnings: Warning[]): Warning[] {
  return [...warnings].sort((left, right) =>
    getWarningMessage(left).localeCompare(getWarningMessage(right)),
  );
}
