import assert from "node:assert/strict";
import { artFor, prepareRasterImages } from "../src/game/art.js";
const crops = [];
globalThis.Image = class {
  set src(v) {
    this.url = v;
    queueMicrotask(() => this.onload());
  }
};
globalThis.document = {
  createElement(tag) {
    assert.equal(tag, "canvas");
    const c = {
      width: 0,
      height: 0,
      getContext() {
        return {
          drawImage(...args) {
            crops.push(args);
          },
        };
      },
      toDataURL() {
        return `data:image/png;${this.width}x${this.height}`;
      },
    };
    return c;
  },
};
await prepareRasterImages();
assert.equal(crops.length, 67);
for (const id of [
  "t-pepper",
  "t-cheese",
  "t-basil",
  "t-oven",
  "t-soda",
  "t-sniper",
  "t-farm",
  "e-tomato",
  "coin",
  "star-gold",
  "e-moldboss",
  "e-chiliboss",
  "e-general",
  "d-tree",
]) {
  const a = artFor(id);
  assert(a.url.startsWith("data:image/png;"));
  assert.deepEqual(a.box, [0, 0, ...a.size]);
  assert(a.size[0] < 500 && a.size[1] < 500);
}
console.log(
  "67 atlas frames become independent bitmaps before scene creation.",
);

await prepareRasterImages();
assert.equal(crops.length, 67, "Preparing twice must reuse existing textures");
