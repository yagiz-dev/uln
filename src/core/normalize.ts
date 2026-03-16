import type { NormalizedDependency } from "../types/dependency.js";
import { mergeWarnings } from "./warnings.js";

export function normalizeDependency(dependency: NormalizedDependency): NormalizedDependency {
  return {
    ...dependency,
    warnings: mergeWarnings(dependency.warnings),
  };
}
