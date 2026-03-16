import { join } from "node:path";
import { fileExists } from "../../utils/fs.js";

export async function detectNpmProject(projectRoot: string): Promise<boolean> {
  const packageJsonPath = join(projectRoot, "package.json");
  const packageLockPath = join(projectRoot, "package-lock.json");

  return (await fileExists(packageJsonPath)) || (await fileExists(packageLockPath));
}
