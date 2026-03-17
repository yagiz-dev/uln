import type { Warning } from "../../types/dependency.js";

export interface ResolvedPackageMetadata {
  licenseExpression?: string;
  licenseWarnings: Warning[];
  homepage?: string;
  repository?: string;
  author?: string;
}

export function createEmptyResolvedPackageMetadata(): ResolvedPackageMetadata {
  return {
    licenseWarnings: [],
  };
}
