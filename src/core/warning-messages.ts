export const WARNING_MESSAGES = {
  licenseFileReference: "License uses a file reference instead of a normalized SPDX expression.",
  licenseNotNormalized:
    "License metadata could not be normalized to a known SPDX-style identifier.",
  npmLockfileMissing:
    "package-lock.json is missing; results only include direct dependencies declared in package.json.",
  npmVersionUnknown: "Dependency version is unknown without package-lock.json.",
  licenseUnavailableWithoutLockfile: "License metadata is unavailable without package-lock.json.",
  licenseMissingFromLockfile: "License metadata is missing from package-lock.json.",
  licenseFileMissing: "Could not find a local license file for this dependency.",
  npmLockfileVersionUnsupported: (lockfileVersion: number): string =>
    `Unsupported package-lock.json version ${lockfileVersion}. Results may be incomplete.`,
} as const;
