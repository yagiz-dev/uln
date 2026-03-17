import { readFile, readdir } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileExists } from "../../utils/fs.js";

const LICENSE_FILE_CANDIDATES = ["LICENSE", "LICENSE.txt", "LICENSE.md", "COPYING", "NOTICE"];
const LICENSE_FILE_CANDIDATES_LOWERCASE = new Set(
  LICENSE_FILE_CANDIDATES.map((candidate) => candidate.toLowerCase()),
);

interface BundledLicenseResult {
  licenseText?: string;
  licenseSourcePath?: string;
  packageDirectoryExists: boolean;
}

function isLicenseFileCandidate(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();

  if (LICENSE_FILE_CANDIDATES_LOWERCASE.has(lowerName)) {
    return true;
  }

  return (
    lowerName.startsWith("license-") ||
    lowerName.startsWith("license.") ||
    lowerName.startsWith("copying-") ||
    lowerName.startsWith("copying.") ||
    lowerName.startsWith("notice-") ||
    lowerName.startsWith("notice.")
  );
}

function toSafeCandidatePath(packageDirectory: string, candidatePath: string): string | undefined {
  const resolvedCandidatePath = resolve(packageDirectory, candidatePath);
  const relativePath = relative(packageDirectory, resolvedCandidatePath);

  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return undefined;
  }

  return resolvedCandidatePath;
}

export async function getBundledLicenseFromDirectory(
  projectRoot: string,
  packageDirectory: string,
  licenseFileHint?: string,
): Promise<BundledLicenseResult> {
  if (!(await fileExists(packageDirectory))) {
    return { packageDirectoryExists: false };
  }

  const candidatePaths: string[] = [];

  if (licenseFileHint) {
    const hintedPath = toSafeCandidatePath(packageDirectory, licenseFileHint);
    if (hintedPath) {
      candidatePaths.push(hintedPath);
    }
  }

  for (const fileName of LICENSE_FILE_CANDIDATES) {
    candidatePaths.push(join(packageDirectory, fileName));
    candidatePaths.push(join(packageDirectory, fileName.toLowerCase()));
  }

  const packageDirectoryEntries = await readdir(packageDirectory, {
    withFileTypes: true,
  }).catch(() => undefined);

  if (!packageDirectoryEntries) {
    return { packageDirectoryExists: true };
  }

  const additionalCandidates = packageDirectoryEntries
    .filter((entry) => entry.isFile() && isLicenseFileCandidate(entry.name))
    .map((entry) => join(packageDirectory, entry.name));

  candidatePaths.push(...additionalCandidates);

  const deduplicatedCandidatePaths = [...new Set(candidatePaths)];

  for (const candidatePath of deduplicatedCandidatePaths) {
    if (!(await fileExists(candidatePath))) {
      continue;
    }

    let contents: string;

    try {
      contents = await readFile(candidatePath, "utf8");
    } catch {
      continue;
    }

    return {
      licenseText: contents.replace(/\r\n/g, "\n").trimEnd(),
      licenseSourcePath: relative(projectRoot, candidatePath),
      packageDirectoryExists: true,
    };
  }

  return { packageDirectoryExists: true };
}
