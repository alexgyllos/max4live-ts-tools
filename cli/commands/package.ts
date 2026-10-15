import { discover, LIMITATIONS } from "../../packaging/dependencies.js";
import { packagePlan, writePackage } from "../../packaging/package.js";
import { requireFiles, type CliArgs } from "../args.js";
import { output, type CliIO } from "../output.js";

export function dependencies(
  command: "deps" | "package",
  files: string[],
  options: CliArgs,
  io: CliIO,
): number {
  requireFiles(command, files, 1);
  const discovery = discover(files[0], {
    roots: options.roots,
    assets: options.assets,
  });
  if (
    command === "package" &&
    !discovery.files.get(discovery.devicePath)?.device
  )
    throw new Error("package requires a supported .amxd device");
  const ok = discovery.dependencies.every((d) => d.status === "resolved");
  const summary = discovery.dependencies
    .map(
      (d) => `${d.reference}  ${d.status}${d.reason ? ` — ${d.reason}` : ""}`,
    )
    .join("\n");
  const base = {
    command,
    file: files[0],
    ok,
    dependencies: discovery.dependencies,
    limitations: LIMITATIONS,
  };
  if (command === "deps") {
    output(
      io,
      options.json,
      base,
      `${files[0]}\n${summary || "No statically identifiable companion files."}\n\n${discovery.dependencies.filter((d) => d.status === "resolved").length} resolved, ${discovery.dependencies.filter((d) => d.status !== "resolved").length} unresolved/missing/ambiguous\nStatic analysis is not exhaustive; use native Max Freeze for a frozen device.\n`,
    );
    return ok ? 0 : 1;
  }
  if (!options.output && !options.dryRun)
    throw new Error("package requires --output <directory> (or --dry-run)");
  const plan = packagePlan(discovery);
  if (options.dryRun || !ok) {
    output(
      io,
      options.json,
      {
        ...base,
        dryRun: options.dryRun,
        written: false,
        output: options.output ?? null,
        manifest: plan.manifest,
      },
      `${summary}\n${plan.files.map((f) => f.path).join("\n")}\n${ok ? "Plan valid; no files written." : "Cannot package unresolved dependencies; no files written."}\n`,
    );
    return ok ? 0 : 1;
  }
  const written = writePackage(discovery, options.output!, options.force);
  output(
    io,
    options.json,
    { ...base, dryRun: false, written: true, ...written },
    `Packaged ${written.manifest.files.length} files in ${written.output}\nDevice: ${written.manifest.device}\nCompanion-file distribution; this is not a frozen device.\n${written.warnings.join("\n")}${written.warnings.length ? "\n" : ""}`,
  );
  return 0;
}
