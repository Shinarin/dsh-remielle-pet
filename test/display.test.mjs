import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const MAX_ICON_BYTES = 256 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function readText(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

const pkg = JSON.parse(readText("package.json"));

test("package metadata matches the official plugin display fields", () => {
  assert.equal(pkg.license, "MIT");
  for (const field of ["description", "author", "homepage", "repository", "bugs"]) {
    assert.ok(pkg[field], `package.json is missing ${field}`);
  }
  assert.match(pkg.homepage, /^https:\/\/github\.com\/Shinarin\/dsh-remielle-pet/);
  assert.equal(pkg.repository.type, "git");
  assert.equal(pkg.repository.url, "git+https://github.com/Shinarin/dsh-remielle-pet.git");
  assert.equal(pkg.bugs.url, "https://github.com/Shinarin/dsh-remielle-pet/issues");
  assert.ok(pkg.keywords.includes("dsh-plugin"), "keywords must expose the dsh-plugin topic convention");
});

test("bundle display resources are exported and packed", () => {
  assert.equal(pkg.dsh.bundle.patch, "./cordis.patch.yml");
  assert.ok(existsSync(join(ROOT, "cordis.patch.yml")), "declared patch file is missing");

  assert.equal(pkg.exports["./locale/*.json"], "./locale/*.json");
  assert.equal(pkg.exports["./icon"], "./icon.png");
  assert.equal(pkg.exports["./client"], "./client.js");
  assert.equal(pkg.exports["."], "./lib/index.js");

  for (const entry of [
    "lib",
    "client.js",
    "cordis.patch.yml",
    "default-gifs",
    "locale",
    "icon.png",
    "README.md",
    "LICENSE",
  ]) {
    assert.ok(pkg.files.includes(entry), `package.json files is missing ${entry}`);
    assert.ok(existsSync(join(ROOT, entry)), `declared file entry is missing from the package: ${entry}`);
  }
});

test("locale files provide a localized title and description", () => {
  for (const lang of ["en", "zh"]) {
    const locale = JSON.parse(readText(`locale/${lang}.json`));
    assert.equal(typeof locale.meta?.title, "string", `locale/${lang}.json meta.title must be a string`);
    assert.ok(locale.meta.title.trim().length > 0, `locale/${lang}.json meta.title must not be empty`);
    assert.equal(typeof locale.meta?.description, "string", `locale/${lang}.json meta.description must be a string`);
    assert.ok(locale.meta.description.trim().length > 0, `locale/${lang}.json meta.description must not be empty`);
  }
  assert.match(JSON.parse(readText("locale/en.json")).meta.title, /[A-Za-z]/, "English locale must stay in English");
});

test("icon is a PNG within the documented size limit", () => {
  const iconPath = join(ROOT, "icon.png");
  assert.ok(existsSync(iconPath), "icon.png is missing");
  const { size } = statSync(iconPath);
  assert.ok(size > 0 && size <= MAX_ICON_BYTES, `icon.png must be 1..${MAX_ICON_BYTES} bytes, got ${size}`);
  const signature = readFileSync(iconPath).subarray(0, PNG_SIGNATURE.length);
  assert.deepEqual([...signature], PNG_SIGNATURE, "icon.png is not a valid PNG file");
});

test("LICENSE matches the declared MIT license", () => {
  const license = readText("LICENSE");
  assert.match(license, /^MIT License/);
  assert.match(license, /Copyright \(c\) 2026 /);
});
