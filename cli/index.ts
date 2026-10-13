#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { runCli } from "./run.js";
const { version } = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { version: string };
process.exitCode = runCli(process.argv.slice(2), version, {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
});
