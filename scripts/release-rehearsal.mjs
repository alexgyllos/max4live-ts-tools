import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const npmPath = process.env.npm_execpath;
if (!npmPath) throw new Error("Use npm run release:check");
for (const script of [
  "lint",
  "typecheck",
  "format:check",
  "test:ci",
  "docs",
  "examples",
  "pack:check",
]) {
  const result = spawnSync(process.execPath, [npmPath, "run", script], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const dry = spawnSync(
  process.execPath,
  [npmPath, "pack", "--dry-run", "--json"],
  { encoding: "utf8" },
);
if (dry.status !== 0) throw new Error(dry.stderr);
const notes = readFileSync("CHANGELOG.md", "utf8")
  .split("## Unreleased")[1]
  ?.split("\n## ")[0]
  ?.trim();
if (!notes) throw new Error("Missing changelog notes");
console.log(
  JSON.stringify(
    {
      rehearsal: true,
      version: manifest.version,
      distributionPerformed: false,
      licenseDeclared: manifest.license,
      private: manifest.private,
      pack: JSON.parse(dry.stdout).map((p) => ({
        filename: p.filename,
        files: p.files.length,
      })),
      releaseNotes: notes,
    },
    null,
    2,
  ),
);
