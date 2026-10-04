import assert from "node:assert/strict";
import { selectTarget } from "../src/game/targeting.js";
import {
  bossOrder,
  bossForWave,
  planWave,
  species,
} from "../src/game/config.js";
import { createEffects } from "../src/game/effects.js";

const enemies = [
  { type: "tomato", x: 20, y: 0, d: 300, hp: 70, shield: 0 },
  { type: "shield", x: 30, y: 0, d: 200, hp: 80, shield: 60 },
  { type: "olive", x: 4, y: 0, d: 100, hp: 50, shield: 0 },
  { type: "healer", x: 15, y: 0, d: 150, hp: 30, shield: 0 },
  { type: "tomato", x: 60, y: 0, d: 900, hp: 900, shield: 0 },
  { type: "healer", x: 1, y: 0, d: 1000, hp: 999, shield: 0, dead: true },
];
const original = [...enemies];
for (const [priority, index] of [
  [0, 0],
  [1, 1],
  [2, 2],
  [3, 3],
])
  assert.equal(selectTarget(enemies, 0, 0, 50, priority), enemies[index]);
assert.equal(selectTarget(enemies, 0, 0, 1), null);
assert.deepEqual(
  enemies,
  original,
  "Target selection must not reorder enemies",
);
assert.equal(
  selectTarget(
    enemies.filter((e) => e.type !== "healer"),
    0,
    0,
    50,
    3,
  ),
  enemies[0],
);

for (const difficulty of [0, 1, 2]) {
  for (let wave = 1; wave <= 48; wave++) {
    const queue = planWave(wave, difficulty);
    assert(queue.every((entry) => species[entry.type] && entry.wave === wave));
    const bosses = queue.filter((entry) => species[entry.type].boss);
    assert.equal(bosses.length, wave % 6 === 0 ? 1 : 0);
    if (bosses.length) {
      assert.equal(bosses[0].type, bossForWave(wave));
      const index = queue.indexOf(bosses[0]);
      assert(
        index > queue.length * 0.4 && index < queue.length * 0.65,
        "Boss arrives among supporting enemies",
      );
    }
    assert(queue.length <= 77, "Bound endless-wave spawning");
  }
}
assert.deepEqual([6, 12, 18, 24].map(bossForWave), bossOrder);
assert.equal(bossForWave(30), "boss");
assert(planWave(12, 1).some((entry) => entry.elite));
assert(planWave(12, 1).length > planWave(12, 0).length);

// Saturating cosmetic effects must not discard a puddle's gameplay slow.
const state = { fx: Array(100).fill({}), enemies: [{ x: 1, y: 1, slow: 0 }] };
const effects = createEffects({
  getState: () => state,
  prefs: { fx: true },
  $: () => ({}),
  el: () => ({ setAttribute() {}, remove() {} }),
});
effects.puddle(0, 0);
const puddle = state.fx.at(-1);
assert.equal(puddle.kind, "puddle");
puddle.update(puddle, 0.25);
assert(state.enemies[0].slow > 0);
console.log(
  "Combat priorities, boss rotation, bounded waves and gameplay effects verified.",
);
