export type SupportedPackageManager = "npm" | "composer";

export type KnownPackageManager = SupportedPackageManager | "pypi";

export type PackageManagerStatus = "supported" | "unsupported";
