import type { PackageManagerAdapter } from "../types.js";
import { detectNpmProject } from "./detect.js";
import { resolveNpmProject } from "./resolve.js";

export const npmAdapter: PackageManagerAdapter = {
  detect: detectNpmProject,
  resolve: resolveNpmProject,
};
