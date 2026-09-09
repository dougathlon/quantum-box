import { lstat, readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const root = resolve(process.cwd());
const excludedDirectories = new Set([
  ".git",
  ".moth-cache",
  ".playwright-browsers",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const forbiddenPaths = [
  ".moth-cache",
  "docs/qa",
  "terminal-story-mockups.html",
  "scripts/render-terminal-story-opening-mockups.mjs",
  "src/qa",
  "src/qongDesigner.css",
  "src/audio/assets/fluxball-01-open-field-likeness-65-region-03-repeated.wav",
  "src/assets/canonical-runtime-assets-v2/assets/designer",
  "src/assets/canonical-runtime-assets-v2/assets/morphs",
  "src/assets/canonical-runtime-assets-v2/assets/player",
  "src/assets/designer-professor",
  "src/assets/qgraph-cabinet-assets-v1/assets/enclose",
  "src/assets/qgraph-cabinet-assets-v1/manifests/runtime-handoff.json",
  "src/assets/qgraph-cabinet-assets-v1/manifests/source-manifest.json",
  "src/debug/DesignerEncounterFixtures.ts",
  "src/display/views/DesignerEncounterView.ts",
  "src/display/views/EncloseView.ts",
  "src/display/views/TutorialWorldView.ts",
  "src/display/views/WorkshopView.ts",
  "src/games/enclose",
  "src/games/qgraph/syntheticCabinetPacks.ts",
  "src/story/DesignerEncounter.ts",
  "src/story/QongDesignerLesson.ts",
  "src/story/storyContent.ts",
  "src/story/v2",
  "tests/fixtures/designer-responsive-harness.html",
];
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".py",
  ".toml",
  ".ts",
  ".txt",
  ".yaml",
  ".yml",
]);
const forbiddenText = [
  ["private macOS path", /\/(?:Users|private\/var)\//],
  ["private local file URL", /file:\/\/\/(?:Users|private\/var)\//i],
  [
    "unredacted bearer credential",
    /Authorization:\s*Bearer\s+(?!\$\{|\[REDACTED\]|<)[^\s"']+/i,
  ],
  [
    "IBM Quantum service CRN",
    new RegExp("crn:v1:bluemix:public:" + "quantum-computing:", "i"),
  ],
  ["presigned AWS URL", /X-Amz-(?:Signature|Credential)=/i],
  ["presigned Google URL", /X-Goog-(?:Signature|Credential)=/i],
];

const failures = [];
for (const forbiddenPath of forbiddenPaths) {
  try {
    await lstat(resolve(root, forbiddenPath));
    failures.push(`${forbiddenPath}: forbidden public-source path is present`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const files = await walk(root);
for (const file of files) {
  const name = relative(root, file);
  const basename = name.slice(name.lastIndexOf("/") + 1);
  if (basename === ".env" || basename.startsWith(".env.")) {
    failures.push(`${name}: environment file is not permitted`);
  }
  if (/\.map$/i.test(name))
    failures.push(`${name}: source map is not permitted`);
  if (/(?:\.bak|\.backup(?:[-.].*)?|~)$/i.test(name)) {
    failures.push(`${name}: backup file is not permitted`);
  }
  const extension = name.slice(name.lastIndexOf("."));
  if (!textExtensions.has(extension)) continue;
  const source = await readFile(file, "utf8");
  for (const [label, pattern] of forbiddenText) {
    if (pattern.test(source)) failures.push(`${name}: ${label}`);
  }
}

if (failures.length > 0) {
  console.error(
    "Quantum Box public-source scan failed:\n" + failures.join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(
    `Quantum Box public-source scan passed for ${files.length} files.`,
  );
}

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) {
      failures.push(
        `${relative(root, path)}: symbolic links are not permitted`,
      );
    } else if (entry.isDirectory()) {
      output.push(...(await walk(path)));
    } else if (entry.isFile()) {
      output.push(path);
    }
  }
  return output;
}
