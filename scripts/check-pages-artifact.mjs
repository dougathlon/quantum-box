import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootPath = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
const indexPath = resolve(rootPath, "index.html");
const noticesPath = resolve(rootPath, "THIRD_PARTY_NOTICES.txt");
const failures = [];

let indexHtml;
try {
  indexHtml = await readFile(indexPath, "utf8");
} catch (error) {
  console.error(
    `GitHub Pages artifact check could not read dist/index.html: ${error}`,
  );
  process.exit(1);
}

try {
  const notices = await readFile(noticesPath, "utf8");
  if (
    !notices.includes("Phaser 3.90.0") ||
    !notices.includes("fast-uri 3.1.6")
  ) {
    failures.push(
      "dist/THIRD_PARTY_NOTICES.txt does not identify the principal MIT and BSD dependencies",
    );
  }
} catch (error) {
  failures.push(`dist/THIRD_PARTY_NOTICES.txt is missing: ${error}`);
}

if (/<base\b/i.test(indexHtml)) {
  failures.push("dist/index.html must not override the deployment base URL");
}

const references = [...indexHtml.matchAll(/\b(?:href|src)="([^"]+)"/g)].map(
  (match) => match[1],
);
for (const reference of references) {
  if (
    reference.startsWith("#") ||
    reference.startsWith("data:") ||
    /^[a-z][a-z\d+.-]*:/i.test(reference)
  ) {
    continue;
  }
  if (reference.startsWith("/")) {
    failures.push(
      `dist/index.html uses root-relative reference ${JSON.stringify(reference)}`,
    );
    continue;
  }

  const cleanReference = reference.split(/[?#]/u, 1)[0];
  if (!cleanReference) continue;
  const target = resolve(rootPath, cleanReference);
  const targetRelative = relative(rootPath, target);
  if (targetRelative.startsWith("..") || targetRelative === "") {
    failures.push(
      `dist/index.html reference escapes the Pages artifact: ${JSON.stringify(reference)}`,
    );
    continue;
  }
  try {
    const targetStat = await lstat(target);
    if (!targetStat.isFile()) {
      failures.push(
        `dist/index.html reference is not a file: ${JSON.stringify(reference)}`,
      );
    }
  } catch {
    failures.push(
      `dist/index.html reference is missing: ${JSON.stringify(reference)}`,
    );
  }
}

const files = await walk(rootPath);
let totalBytes = 0;
for (const file of files) {
  const fileStat = await lstat(file);
  const name = relative(rootPath, file);
  totalBytes += fileStat.size;
  if (fileStat.isSymbolicLink()) {
    failures.push(
      `${name}: symbolic links are not permitted in a Pages artifact`,
    );
  }
  if (fileStat.nlink > 1) {
    failures.push(`${name}: hard links are not permitted in a Pages artifact`);
  }
  if (fileStat.size > 100 * 1024 * 1024) {
    failures.push(`${name}: file exceeds GitHub's 100 MiB repository limit`);
  }
}

if (totalBytes > 1024 * 1024 * 1024) {
  failures.push(
    "dist: artifact exceeds GitHub Pages' 1 GiB published-site limit",
  );
}

if (failures.length > 0) {
  console.error("GitHub Pages artifact check failed:\n" + failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `GitHub Pages artifact check passed: ${files.length} files, ${formatBytes(totalBytes)}, all entry references subpath-safe.`,
  );
}

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory)) {
    const path = resolve(directory, entry);
    const entryStat = await lstat(path);
    if (entryStat.isDirectory()) output.push(...(await walk(path)));
    else output.push(path);
  }
  return output;
}

function formatBytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}
