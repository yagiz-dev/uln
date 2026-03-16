import type { NormalizedDependency } from "../types/dependency.js";

export function getPackageId(
  dependency: Pick<NormalizedDependency, "packageManager" | "name" | "version">,
): string {
  return `${dependency.packageManager}:${dependency.name}@${dependency.version}`;
}
