import type { PackageManagerAdapter } from "../types.js";
import { detectComposerProject } from "./detect.js";
import { resolveComposerProject } from "./resolve.js";

export const composerAdapter: PackageManagerAdapter = {
  detect: detectComposerProject,
  resolve: resolveComposerProject,
};
