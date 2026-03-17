import type { NormalizedDependency } from "../types/dependency.js";
import { getPackageId } from "../utils/package-id.js";
import { sortDependencies, sortWarnings } from "../utils/sort.js";

export function mergeDependencies(dependencies: NormalizedDependency[]): NormalizedDependency[] {
  const merged = new Map<string, NormalizedDependency>();

  for (const dependency of dependencies) {
    const id = getPackageId(dependency);
    const existing = merged.get(id);

    if (!existing) {
      merged.set(id, {
        ...dependency,
        warnings: sortWarnings(dependency.warnings),
      });
      continue;
    }

    merged.set(id, {
      ...existing,
      direct: existing.direct || dependency.direct,
      licenseExpression: existing.licenseExpression ?? dependency.licenseExpression,
      licenseText: existing.licenseText ?? dependency.licenseText,
      licenseSourcePath: existing.licenseSourcePath ?? dependency.licenseSourcePath,
      homepage: existing.homepage ?? dependency.homepage,
      repository: existing.repository ?? dependency.repository,
      author: existing.author ?? dependency.author,
      warnings: sortWarnings([...existing.warnings, ...dependency.warnings]),
    });
  }

  return sortDependencies([...merged.values()]);
}
