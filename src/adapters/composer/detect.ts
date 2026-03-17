import { join } from "node:path";
import { fileExists } from "../../utils/fs.js";

export async function detectComposerProject(projectRoot: string): Promise<boolean> {
  const composerJsonPath = join(projectRoot, "composer.json");
  const composerLockPath = join(projectRoot, "composer.lock");

  return (await fileExists(composerJsonPath)) || (await fileExists(composerLockPath));
}
