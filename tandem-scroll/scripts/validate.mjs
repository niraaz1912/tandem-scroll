import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

assert.equal(manifest.manifest_version, 3, "The extension must use Manifest V3.");
assert.ok(manifest.name, "The manifest needs a name.");
assert.ok(manifest.version, "The manifest needs a version.");

const referencedFiles = new Set([
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  ...Object.values(manifest.action?.default_icon ?? {}),
  ...Object.values(manifest.icons ?? {}),
  ...(manifest.content_scripts ?? []).flatMap((entry) => [
    ...(entry.js ?? []),
    ...(entry.css ?? []),
  ]),
].filter(Boolean));

for (const relativePath of referencedFiles) {
  assert.ok(
    existsSync(join(root, relativePath)),
    `Manifest reference does not exist: ${relativePath}`,
  );
}

for (const iconPath of Object.values(manifest.icons ?? {})) {
  const bytes = readFileSync(join(root, iconPath));
  assert.equal(
    bytes.subarray(0, 8).toString("hex"),
    "89504e470d0a1a0a",
    `${iconPath} is not a valid PNG file.`,
  );
}

const scripts = [
  "background.js",
  "content.js",
  "pairing.js",
  "popup/popup.js",
  "shared/scroll-math.js",
];

for (const script of scripts) {
  const check = spawnSync(process.execPath, ["--check", join(root, script)], {
    encoding: "utf8",
  });
  assert.equal(
    check.status,
    0,
    `JavaScript syntax check failed for ${script}:\n${check.stderr}`,
  );
}

console.log(`Validated ${referencedFiles.size} manifest assets and ${scripts.length} scripts.`);
