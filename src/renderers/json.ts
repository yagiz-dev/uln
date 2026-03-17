import type { ScanResult } from "../types/dependency.js";
import type { HideableOutputField } from "../config/types.js";

export interface RenderJsonOptions {
  hideFields?: HideableOutputField[];
}

export function renderJson(results: ScanResult[], options: RenderJsonOptions = {}): string {
  const hideFields = new Set(options.hideFields ?? []);

  if (hideFields.size === 0) {
    return JSON.stringify(results, null, 2);
  }

  const renderedResults = results.map((result) => ({
    ...result,
    dependencies: result.dependencies.map((dependency) => {
      const renderedDependency = {
        ...dependency,
      } as Record<string, unknown>;

      for (const field of hideFields) {
        delete renderedDependency[field];
      }

      return renderedDependency;
    }),
  }));

  return JSON.stringify(renderedResults, null, 2);
}
