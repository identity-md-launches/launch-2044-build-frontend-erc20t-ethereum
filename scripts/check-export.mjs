import { readdir, stat, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";

const roots = ["src", "public", "assets", "dist", "docs", "tests", "scripts"];
const files = [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vite.config.ts",
  "index.html",
  "README.md",
  "DESIGN.md",
  "BUDGET.md",
  ".gitignore",
];
async function walk(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = join(path, entry.name);
    if (file === "test/scratch") continue;
    assert.ok(!entry.isSymbolicLink(), `No submission symlinks: ${file}`);
    assert.ok(
      !["node_modules", ".cache", ".npm", ".pnpm-store", ".vite"].includes(
        entry.name,
      ),
      `Generated dependency/cache: ${file}`,
    );
    assert.ok(
      !/\.(tgz|tar|tsbuildinfo|map)$/.test(file),
      `Unnecessary packaging artifact: ${file}`,
    );
    if (entry.isDirectory()) await walk(file);
    else files.push(file);
  }
}
for (const root of roots) await walk(root);
const sizes = await Promise.all(
  files.map(async (file) => ({ file, bytes: (await stat(file)).size })),
);
const total = sizes.reduce((sum, item) => sum + item.bytes, 0);
assert.ok(total <= 8388608, `Submission exceeds 8 MiB: ${total}`);
assert.ok(
  (await stat(".gitignore")).size <= 1024,
  ".gitignore exceeds explicit 1 KiB budget",
);
const html = await readFile("dist/index.html", "utf8");
for (const marker of [
  "<title>",
  'name="description"',
  'rel="icon"',
  'property="og:title"',
  'property="og:image"',
])
  assert.ok(html.includes(marker), `Missing metadata: ${marker}`);
const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
urls.push(html.match(/property="og:image"\s+content="([^"]+)"/)[1]);
for (const url of urls) {
  assert.ok(url.startsWith("./"), `Asset URL must be relative: ${url}`);
  await stat(resolve("dist", url));
}
assert.ok(html.includes('type="module"'), "Missing compiled module");
assert.ok(!html.includes("/src/"), "Export references unbuilt source");
console.log(
  JSON.stringify(
    {
      passed: true,
      files: files.length,
      bytes: total,
      ceiling: 8388608,
      distBytes: sizes
        .filter((s) => s.file.startsWith("dist/"))
        .reduce((n, s) => n + s.bytes, 0),
      ignoreBytes: (await stat(".gitignore")).size,
      relativeAssets: urls,
    },
    null,
    2,
  ),
);
