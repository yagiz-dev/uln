export type SupportedPackageManager = "npm";

export type KnownPackageManager = SupportedPackageManager | "composer" | "pypi";

export type PackageManagerStatus = "supported" | "unsupported";
