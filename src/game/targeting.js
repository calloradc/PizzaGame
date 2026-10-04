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
            ? (enemy.type === "healer" ? 1e6 : 0) + enemy.d
            : enemy.d;
    if (score > bestScore) {
      best = enemy;
      bestScore = score;
    }
  }
  return best;
}
