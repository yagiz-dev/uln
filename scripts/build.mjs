import { cp } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "tsup";
import packageJson from "../package.json" with { type: "json" };

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");

await build({
  clean: true,
  cwd: projectRoot,
  define: {
    __ULN_VERSION__: JSON.stringify(packageJson.version),
  },
  dts: true,
  entry: ["src/cli/index.ts"],
  format: ["esm"],
});

await cp(resolve(projectRoot, "LICENSE"), resolve(projectRoot, "dist", "LICENSE"));
