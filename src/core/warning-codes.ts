export const WARNING_CODES = {
  licenseFileReference: "license_file_reference",
  licenseHeuristicallyNormalized: "license_heuristically_normalized",
  licenseFileMissing: "license_file_missing",
  licenseMissing: "license_missing",
  licenseNotNormalized: "license_not_normalized",
  npmLockfileMissing: "npm_lockfile_missing",
  npmLockfileVersionUnsupported: "npm_lockfile_version_unsupported",
  npmVersionUnknown: "npm_version_unknown",
  repositoryMissing: "repository_missing",
} as const;

export type WarningCode = (typeof WARNING_CODES)[keyof typeof WARNING_CODES];

export interface WarningDetailsByCode {
  [WARNING_CODES.licenseHeuristicallyNormalized]: {
    normalizedExpression: string;
  };
  [WARNING_CODES.licenseMissing]: {
    reason: "missing_from_lockfile" | "without_lockfile";
  };
  [WARNING_CODES.npmLockfileVersionUnsupported]: {
    lockfileVersion: number;
  };
}

export type WarningDetails = WarningDetailsByCode[keyof WarningDetailsByCode];

export function getWarningMessage(input: { code: WarningCode; details?: WarningDetails }): string {
  switch (input.code) {
    case WARNING_CODES.licenseFileReference:
      return "License uses a file reference instead of a normalized SPDX expression.";
    case WARNING_CODES.licenseHeuristicallyNormalized:
      return `License metadata was normalized heuristically to SPDX expression "${(input.details as WarningDetailsByCode[typeof WARNING_CODES.licenseHeuristicallyNormalized] | undefined)?.normalizedExpression ?? "unknown"}".`;
    case WARNING_CODES.licenseFileMissing:
      return "Could not find a local license file for this dependency.";
    case WARNING_CODES.licenseMissing:
      return (
        input.details as WarningDetailsByCode[typeof WARNING_CODES.licenseMissing] | undefined
      )?.reason === "without_lockfile"
        ? "License metadata is unavailable without package-lock.json."
        : "License metadata is missing from package-lock.json.";
    case WARNING_CODES.licenseNotNormalized:
      return "License metadata could not be normalized to a known SPDX-style identifier.";
    case WARNING_CODES.npmLockfileMissing:
      return "package-lock.json is missing; results only include direct dependencies declared in package.json.";
    case WARNING_CODES.npmLockfileVersionUnsupported:
      return `Unsupported package-lock.json version ${(input.details as WarningDetailsByCode[typeof WARNING_CODES.npmLockfileVersionUnsupported] | undefined)?.lockfileVersion ?? "unknown"}. Results may be incomplete.`;
    case WARNING_CODES.npmVersionUnknown:
      return "Dependency version is unknown without package-lock.json.";
    case WARNING_CODES.repositoryMissing:
      return "Repository metadata is missing.";
  }
}
