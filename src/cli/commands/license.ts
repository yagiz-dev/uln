import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Command } from "commander";

export async function readBundledLicense(): Promise<string> {
  const currentDirectory = dirname(fileURLToPath(import.meta.url));
  const distLicensePath = join(currentDirectory, "..", "LICENSE");

  try {
    return await readFile(distLicensePath, "utf8");
  } catch {
    const sourceLicensePath = join(currentDirectory, "..", "..", "..", "LICENSE");
    return readFile(sourceLicensePath, "utf8");
  }
}

export function registerLicenseCommand(program: Command): void {
  program
    .command("license")
    .description("Show licensing information for uln.")
    .action(async () => {
      const licenseContents = await readBundledLicense();
      process.stdout.write(licenseContents);

      if (!licenseContents.endsWith("\n")) {
        process.stdout.write("\n");
      }
    });
}
