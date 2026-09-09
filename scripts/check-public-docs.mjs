import { readFile, stat } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

const root = resolve(process.cwd());
const documents = [
  "README.md",
  "CONTRIBUTING.md",
  "docs/README.md",
  "docs/project-map.md",
  "docs/current-status.md",
  "docs/editing-visuals-and-ai.md",
];

const failures = [];
for (const document of documents) {
  const absolute = resolve(root, document);
  const source = await readFile(absolute, "utf8");
  for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, "");
    if (/^(?:https?:|mailto:|#)/i.test(rawTarget)) continue;
    const target = decodeURIComponent(rawTarget.split("#", 1)[0]);
    const resolved = resolve(dirname(absolute), target);
    if (relative(root, resolved).startsWith("..")) {
      failures.push(`${document}: link escapes the repository: ${rawTarget}`);
      continue;
    }
    try {
      await stat(resolved);
    } catch {
      failures.push(`${document}: missing local link target: ${rawTarget}`);
    }
  }
}

const readme = await readFile(resolve(root, "README.md"), "utf8");
for (const required of [
  "https://dougathlon.github.io/quantum-box/",
  "Qong",
  "SkiPixl",
  "Fluxball",
  "Quantman",
  "Quarry",
  "pnpm install --frozen-lockfile",
  "pnpm test:e2e",
]) {
  if (!readme.includes(required)) {
    failures.push(`README.md: missing required newcomer detail: ${required}`);
  }
}

const contributing = await readFile(resolve(root, "CONTRIBUTING.md"), "utf8");
for (const required of [
  "open-source project licence",
  "pnpm check",
  "pnpm test:e2e",
  "Provider-returned bytes",
  "320×180",
]) {
  if (!contributing.includes(required)) {
    failures.push(`CONTRIBUTING.md: missing required boundary: ${required}`);
  }
}

if (failures.length > 0) {
  console.error(
    "Quantum Box public documentation check failed:\n" + failures.join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(
    `Quantum Box public documentation check passed for ${documents.length} entry documents.`,
  );
}
