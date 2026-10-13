import { rmSync, chmodSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
rmSync(new URL("../dist", import.meta.url), { recursive: true, force: true });
const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(
      new URL("../node_modules/typescript/bin/tsc", import.meta.url),
    ),
    "-p",
    "tsconfig.build.json",
  ],
  { stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);
chmodSync(new URL("../dist/cli/index.js", import.meta.url), 0o755);
