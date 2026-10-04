import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("dist");
const walk = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
const files = walk(root).map((file) => path.relative(root, file));
assert(files.includes("index.html"), "Built index.html missing");
for (const file of files) {
  assert(
    !/\.(?:map|zip|jsx|tsx|ts)$/.test(file),
    `Source or archive in release: ${file}`,
  );
  assert(
    !/^(?:src|scripts|node_modules|\.git|js|css)\//.test(file),
    `Development directory in release: ${file}`,
  );
  assert(
    !/(?:package(?:-lock)?\.json|README\.md|vite\.config)/.test(file),
    `Development file in release: ${file}`,
  );
  if (file.endsWith(".js") || file.endsWith(".css")) {
    assert(
      /^assets\/.+-[\w-]+\.(?:js|css)$/.test(file),
      `Unbundled code in release: ${file}`,
    );
    const code = fs.readFileSync(path.join(root, file), "utf8");
    assert(
      !code.includes("sourceMappingURL="),
      `Source map reference in ${file}`,
    );
    assert(!code.includes("sourcesContent"), `Embedded sources in ${file}`);
  }
}
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
for (const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
  assert(
    match[1].startsWith("./"),
    `Non-relative release reference ${match[1]}`,
  );
  assert(
    fs.existsSync(path.join(root, match[1])),
    `Missing release reference ${match[1]}`,
  );
}
assert(!html.includes("/src/"), "Development entrypoint published");
const css = files
  .filter((file) => file.endsWith(".css"))
  .map((file) => fs.readFileSync(path.join(root, file), "utf8"))
  .join("\n");
for (const match of css.matchAll(/url\(['"]?([^\)'"#]+)['"]?\)/g)) {
  assert(
    fs.existsSync(path.resolve(root, "assets", match[1])),
    `Missing built CSS asset ${match[1]}`,
  );
}
assert(
  files.includes("assets/font-notice.txt"),
  "Font license missing from release",
);
console.log(
  `Production release verified: ${files.length} files, bundled code, relative URLs, no source maps or source archives.`,
);
