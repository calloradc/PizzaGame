export const distanceSquared = (ax, ay, bx, by) =>
  (ax - bx) ** 2 + (ay - by) ** 2;

// Choose a target in one pass; firing never allocates and sorts the whole enemy list.
export function selectTarget(enemies, x, y, range, priority = 0) {
  let best = null,
    bestScore = -Infinity;
  const radius = range * range;
  for (const enemy of enemies) {
    if (enemy.dead) continue;
    const distance = distanceSquared(enemy.x, enemy.y, x, y);
    if (distance >= radius) continue;
    const score =
      priority === 1
        ? enemy.hp + enemy.shield
        : priority === 2
          ? -distance
          : priority === 3
            ? (["healer", "mint"].includes(enemy.type) ? 1e6 : 0) + enemy.d
            : enemy.d;
    if (score > bestScore) {
      best = enemy;
      bestScore = score;
    }
  }
  return best;
}

// Fixed buckets avoid scanning the entire swarm for every tower and healer.
export function createSpatialIndex(cellSize = 64) {
  const buckets = new Map();
  return {
    rebuild(enemies) {
      for (const bucket of buckets.values()) bucket.length = 0;
      for (const enemy of enemies) {
        if (enemy.dead) continue;
        const key = `${Math.floor(enemy.x / cellSize)},${Math.floor(enemy.y / cellSize)}`;
        let bucket = buckets.get(key);
        if (!bucket) {
          bucket = [];
          buckets.set(key, bucket);
        }
        bucket.push(enemy);
      }
    },
    query(x, y, radius) {
      const result = [];
      const squared = radius * radius;
      for (
        let row = Math.floor((y - radius) / cellSize);
        row <= Math.floor((y + radius) / cellSize);
        row++
      ) {
        for (
          let col = Math.floor((x - radius) / cellSize);
          col <= Math.floor((x + radius) / cellSize);
          col++
        ) {
          const bucket = buckets.get(`${col},${row}`);
          if (!bucket) continue;
          for (const enemy of bucket)
            if (
              !enemy.dead &&
              distanceSquared(x, y, enemy.x, enemy.y) <= squared
            )
              result.push(enemy);
        }
      }
      return result;
    },
  };
}
