import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
const git = (args) => {
  const r = spawnSync("git", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout;
};
const commits = git(["rev-list", "--all"]).trim().split("\n").filter(Boolean);
const secret =
  /gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
const findings = [];
const seen = new Set();
for (const commit of commits) {
  const rows = git(["ls-tree", "-r", commit])
    .trim()
    .split("\n")
    .filter(Boolean);
  for (const row of rows) {
    const [entry, path] = row.split("\t");
    const hash = entry.split(" ")[2];
    if (seen.has(hash)) continue;
    seen.add(hash);
    const content = git(["cat-file", "blob", hash]);
    if (secret.test(content))
      findings.push({ kind: "secret-pattern", commit, path });
  }
}
const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const dependencies = {};
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const transitive = Object.fromEntries(
  Object.entries(lock.packages)
    .filter(([path]) => path)
    .map(([path, data]) => [
      path,
      {
        version: data.version,
        license: data.license ?? "unspecified",
        dev: !!data.dev,
      },
    ]),
);
for (const name of [
  ...Object.keys(manifest.dependencies ?? {}),
  ...Object.keys(manifest.devDependencies ?? {}),
]) {
  const data = JSON.parse(
    readFileSync(`node_modules/${name}/package.json`, "utf8"),
  );
  dependencies[name] = {
    version: data.version,
    license: data.license ?? "unspecified",
  };
}
console.log(
  JSON.stringify(
    {
      commits: commits.length,
      uniqueBlobs: seen.size,
      findings,
      directDependencyLicenses: dependencies,
      transitiveDependencyLicenses: transitive,
      limitations:
        "Pattern scan only; manual IP/rights review and transitive licence review required. No credential-pattern match proves neither absence of other private data nor ownership.",
    },
    null,
    2,
  ),
);
if (findings.some((f) => f.kind === "secret-pattern")) process.exitCode = 1;
