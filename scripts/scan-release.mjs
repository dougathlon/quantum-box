import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const root = new URL("../dist/", import.meta.url);
const rootPath = decodeURIComponent(root.pathname);
const files = await walk(rootPath);

const forbidden = [
  [
    "unredacted bearer credential",
    /Authorization:\s*Bearer\s+(?!\[REDACTED\])[^\s"']+/i,
  ],
  ["Moth credential variable", /MOTH_API_KEY/],
  ["IBM QPU credential variable", /IBM_QPU_(?:TOKEN|INSTANCE)/],
  ["presigned AWS URL", /X-Amz-(?:Signature|Credential)=/i],
  ["presigned Google URL", /X-Goog-(?:Signature|Credential)=/i],
  ["cookie material", /(?:Set-Cookie|Cookie:)\s*/i],
  ["private macOS path", /\/(?:Users|private\/var)\//],
  ["private local file URL", /file:\/\/\/(?:Users|private\/var)\//i],
  ["retired Enclose cabinet", /\benclose\b/i],
];

const failures = [];
for (const file of files) {
  const name = relative(rootPath, file);
  if (/\benclose\b/i.test(name)) {
    failures.push(`${name}: retired cabinet asset name`);
  }
  if (name.endsWith(".map")) {
    failures.push(
      `${name}: source map is not permitted in the release artifact`,
    );
  }
  const text = (await readFile(file)).toString("utf8");
  for (const [label, pattern] of forbidden) {
    if (pattern.test(text)) failures.push(`${name}: ${label}`);
  }
}

if (failures.length > 0) {
  console.error("Quantum Box release scan failed:\n" + failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Quantum Box release scan passed for ${files.length} files.`);
}

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory)) {
    const path = join(directory, entry);
    if ((await stat(path)).isDirectory()) output.push(...(await walk(path)));
    else output.push(path);
  }
  return output;
}
