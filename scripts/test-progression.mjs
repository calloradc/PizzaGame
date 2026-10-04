import assert from "node:assert/strict";
import {
  migrateProgress,
  unlock,
  claimMission,
} from "../src/game/progression.js";
import { createSpatialIndex, selectTarget } from "../src/game/targeting.js";
import { recipes, species, abilities, planWave } from "../src/game/config.js";
import { englishDictionary } from "../src/game/i18n.js";
const beginner = migrateProgress({ best: 0 }, null);
assert.deepEqual(beginner.unlockedTowers, [0, 1]);
assert.equal(beginner.wallet, 150);
assert(unlock(beginner, "tower", 2));
assert.equal(beginner.wallet, 50);
assert(!unlock(beginner, "tower", 2));
assert(!unlock(beginner, "tower", 9));
assert(!unlock(beginner, "ability", "oops"));
assert(!unlock(beginner, "oops", 3));
assert(!claimMission(beginner, "kills"));
beginner.kills = 100;
assert(claimMission(beginner, "kills"));
assert.equal(beginner.wallet, 170);
assert(!claimMission(beginner, "kills"));
assert.equal(beginner.wallet, 170);
const legacy = migrateProgress(
  { best: 6, built: 1 },
  { towers: [{ type: 9 }] },
);
assert(legacy.unlockedTowers.includes(9));
assert(legacy.unlockedTowers.includes(6));
assert(legacy.unlockedAbilities.includes("repair"));
const restored = migrateProgress(beginner, null);
assert.equal(restored.wallet, 170);
assert.deepEqual(restored.claimed, ["kills"]);
const enemies = Array.from({ length: 180 }, (_, i) => ({
  type: i % 15 === 0 ? "mint" : "tomato",
  x: (i % 18) * 24 - 20,
  y: Math.floor(i / 18) * 37,
  d: i * 10,
  hp: i + 1,
  shield: 0,
  dead: i % 31 === 0,
}));
const spatial = createSpatialIndex();
spatial.rebuild(enemies);
for (const radius of [30, 80, 160])
  for (const priority of [0, 1, 2, 3]) {
    const indexed = selectTarget(
      spatial.query(150, 110, radius),
      150,
      110,
      radius,
      priority,
    );
    const linear = selectTarget(enemies, 150, 110, radius, priority);
    assert.equal(
      indexed,
      linear,
      "Spatial targeting must match full-world selection",
    );
  }
enemies.forEach((e) => {
  e.x += 300;
  e.y -= 500;
});
spatial.rebuild(enemies);
assert.equal(spatial.query(150, 110, 80).length, 0);
for (const type of ["onion", "popcorn", "mint"])
  assert(planWave(12, 1).some((e) => e.type === type));
assert.equal(recipes.length, 10);
assert.equal(abilities.length, 7);
assert.equal(Object.keys(species).length, 15);
for (const r of recipes)
  for (const string of [r.name, r.desc, r.role, ...r.branches.flat()])
    assert(englishDictionary[string], `Translation missing: ${string}`);
for (const enemy of Object.values(species))
  for (const string of [enemy.name, enemy.desc])
    assert(englishDictionary[string], `Translation missing: ${string}`);
console.log(
  "Persistent unlocks, single-claim rewards, legacy migration, spatial targeting and translations verified.",
);
