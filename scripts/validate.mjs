import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve("src");
const required = [
  "main.jsx",
  "App.jsx",
  "components.jsx",
  ...["engine", "config", "effects", "audio", "art"].map(
    (name) => `game/${name}.js`,
  ),
  ...["game", "polish", "casual", "ultra"].map((name) => `styles/${name}.css`),
  ...[
    "towers-atlas.png",
    "enemies-atlas.png",
    "garden.png",
    "icons-atlas.png",
    "ammo-atlas.png",
    "sprites.svg",
    "board.svg",
    "favicon.svg",
    "rubik-regular.woff",
    "rubik-bold.woff",
  ].map((name) => `assets/${name}`),
];
for (const file of required)
  assert(
    fs.statSync(path.join(root, file)).size > 0,
    `Missing source or asset: ${file}`,
  );
for (const file of fs.readdirSync(path.join(root, "game"))) {
  if (file.endsWith(".js"))
    execFileSync(process.execPath, ["--check", path.join(root, "game", file)]);
}
for (const name of ["game", "polish", "casual", "ultra"]) {
  const css = fs.readFileSync(path.join(root, `styles/${name}.css`), "utf8");
  for (const match of css.matchAll(/url\(['"]?([^\)'"#]+)['"]?\)/g)) {
    assert(
      fs.existsSync(path.resolve(root, "styles", match[1])),
      `Missing CSS reference ${match[1]}`,
    );
  }
}
const svg = ["sprites", "board"]
  .map((name) => fs.readFileSync(path.join(root, `assets/${name}.svg`), "utf8"))
  .join("\n");
const ids = new Set(
  [...svg.matchAll(/id="([^"]+)"/g)].map((match) => match[1]),
);
for (const match of svg.matchAll(/(?:href="#|url\(#)([^"\)]+)/g))
  assert(ids.has(match[1]), `Missing SVG reference ${match[1]}`);
assert(
  fs.statSync("public/assets/font-notice.txt").size > 0,
  "Font license missing",
);
console.log(
  "React sources, engine syntax, assets, fonts and SVG references verified.",
);
