import assert from "node:assert/strict";
import { artFor, placeArt, rasterIcon } from "../src/game/art.js";
import { recipes, species, abilities, perks } from "../src/game/config.js";
for (const id of [
  ...recipes.map((recipe) => `t-${recipe.id}`),
  ...Object.keys(species).map((type) => `e-${type}`),
  ...abilities.map((ability) => ability.icon),
  ...perks.map((perk) => perk.icon),
])
  assert(artFor(id), `Game content requires a raster frame: ${id}`);
const ids = [
  "t-pepper",
  "t-cheese",
  "t-basil",
  "t-oven",
  "t-soda",
  "t-sniper",
  "t-farm",
  "pizza",
  "shop",
  "e-tomato",
  "e-olive",
  "e-mush",
  "e-healer",
  "e-pepper",
  "e-dough",
  "e-shield",
  "e-boss",
  "e-crumb",
  "coin",
  "heart",
  "flag",
  "bomb",
  "blizzard",
  "trap",
  "chili",
  "repair",
  "i-build",
  "i-intel",
  "i-gear",
  "i-pause",
  "i-play",
  "i-close",
  "i-full",
  "medal",
  "i-target",
  "a-pepper",
  "a-cheese",
  "a-basil",
  "a-oven",
  "a-soda",
  "a-sniper",
  "a-farm",
  "star-gold",
  "star-blue",
  "i-upgrade",
  "e-moldboss",
  "e-chiliboss",
  "e-general",
  "d-daisy",
  "d-pink",
  "d-pot",
  "d-hedge",
  "d-tree",
  "d-bench",
  "d-rocks",
  "d-fence",
  "d-mushrooms",
];
const clips = new Set();
const el = (tag, attrs = {}, parent) => {
  let n = { tag, attrs, children: [] };
  parent?.children.push(n);
  return n;
};
for (const id of ids) {
  const a = artFor(id);
  assert(a, id);
  const [x, y, w, h] = a.box;
  assert(
    x >= 0 &&
      y >= 0 &&
      w > 0 &&
      h > 0 &&
      x + w <= a.size[0] &&
      y + h <= a.size[1],
    id,
  );
  let n = placeArt(el, id, { x: 14, y: 23, width: 56, height: 48 });
  assert.equal(n.tag, "g");
  assert.equal(n.attrs.transform, "translate(14 23)");
  let clip = n.children[0].children[0],
    rect = clip.children[0],
    group = n.children[1],
    im = group.children[0];
  assert.equal(clip.attrs.clipPathUnits, "userSpaceOnUse");
  assert.equal(rect.attrs.width, 56);
  assert.equal(rect.attrs.height, 48);
  assert.equal(group.attrs["clip-path"], `url(#${clip.attrs.id})`);
  assert(!clips.has(clip.attrs.id));
  clips.add(clip.attrs.id);
  const k = Math.min(56 / w, 48 / h);
  assert(Math.abs(im.attrs.x + x * k - (56 - w * k) / 2) < 0.00001);
  assert.equal(im.attrs.width, a.size[0] * k);
  assert.match(rasterIcon(id), /clip-path="url\(#spriteClip\d+\)"/);
}
console.log(
  `${ids.length} raster sprites: isolated clipping, unique masks, frame bounds and scaling passed.`,
);
