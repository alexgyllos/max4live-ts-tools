// Adapted from @tsln/create-max 0.1.0's MIT-licensed build conventions.
// Max scripts stay unexported; neutral CommonJS with tree shaking disabled keeps handlers.
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import * as esbuild from "esbuild";
const root = fileURLToPath(new URL(".", import.meta.url));
const generate = () => {
  const result = spawnSync(process.execPath, [".build/generate-device.mjs"], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error("Device generation failed");
};
const runtime = {
  entryPoints: readdirSync(new URL("src/", import.meta.url))
    .filter((n) => /\.tsx?$/.test(n) && !n.endsWith(".d.ts"))
    .map((n) => fileURLToPath(new URL(`src/${n}`, import.meta.url))),
  outdir: fileURLToPath(new URL("js/", import.meta.url)),
  bundle: true,
  format: "cjs",
  platform: "neutral",
  conditions: ["browser"],
  mainFields: ["main", "module"],
  target: "es2022",
  treeShaking: false,
  legalComments: "eof",
  logLevel: "info",
};
const builder = {
  entryPoints: [
    fileURLToPath(new URL("build/generate-device.ts", import.meta.url)),
  ],
  outfile: fileURLToPath(
    new URL(".build/generate-device.mjs", import.meta.url),
  ),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  plugins: [
    {
      name: "generate-device",
      setup(b) {
        b.onEnd((result) => {
          if (!result.errors.length) generate();
        });
      },
    },
  ],
};
if (process.argv.includes("--watch")) {
  // Reuse esbuild's dependency-aware watcher for both independent environments.
  const contexts = await Promise.all([
    esbuild.context(runtime),
    esbuild.context(builder),
  ]);
  await Promise.all(contexts.map((context) => context.watch()));
  console.log(
    "Watching runtime and device sources; reopen the .amxd after graph changes.",
  );
} else {
  await esbuild.build(runtime);
  await esbuild.build(builder);
}
