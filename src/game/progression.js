import { recipes, abilities } from "./config.js";
export const towerPrices = [0, 0, 100, 140, 190, 160, 120, 180, 240, 300];
export const abilityPrices = {
  bomb: 0,
  freeze: 0,
  trap: 100,
  rally: 140,
  repair: 160,
  pulse: 220,
  supply: 200,
};
export const missions = [
  {
    id: "build",
    name: "Первая смена",
    desc: "Построй 10 башен",
    key: "built",
    target: 10,
    reward: 80,
  },
  {
    id: "kills",
    name: "Горячая кухня",
    desc: "Победи 100 врагов",
    key: "kills",
    target: 100,
    reward: 120,
  },
  {
    id: "boss",
    name: "Без короны",
    desc: "Победи 3 боссов",
    key: "boss",
    target: 3,
    reward: 180,
  },
  {
    id: "specs",
    name: "Секретный рецепт",
    desc: "Выбери 5 специализаций",
    key: "specs",
    target: 5,
    reward: 120,
  },
  {
    id: "wins",
    name: "Мастер кухни",
    desc: "Заверши один забег",
    key: "wins",
    target: 1,
    reward: 250,
  },
];
export function migrateProgress(meta, checkpoint) {
  const veteran =
    meta.best > 0 || meta.built > 0 || checkpoint?.towers?.length > 0;
  return {
    ...meta,
    wallet: Math.max(0, Number.isFinite(meta.wallet) ? meta.wallet : 150),
    unlockedTowers: [
      ...new Set([
        0,
        1,
        ...(Array.isArray(meta.unlockedTowers)
          ? meta.unlockedTowers
          : veteran
            ? [2, 3, 4, 5, 6]
            : []),
        ...(checkpoint?.towers || []).map((t) => t.type),
      ]),
    ].filter((i) => recipes[i]),
    unlockedAbilities: [
      ...new Set([
        "bomb",
        "freeze",
        ...(Array.isArray(meta.unlockedAbilities)
          ? meta.unlockedAbilities
          : veteran
            ? ["trap", "rally", "repair"]
            : []),
      ]),
    ].filter((id) => abilities.some((a) => a.id === id)),
    claimed: Array.isArray(meta.claimed) ? meta.claimed : [],
    records: meta.records || {},
    adReadyAt: Number(meta.adReadyAt) || 0,
    dailyClaimed: Number(meta.dailyClaimed) || 0,
  };
}
export function unlock(meta, kind, id) {
  const tower = kind === "tower";
  if (!tower && kind !== "ability") return false;
  const item = tower ? recipes[id] : abilities.find((a) => a.id === id);
  const list = tower ? meta.unlockedTowers : meta.unlockedAbilities;
  const price = tower ? towerPrices[id] : abilityPrices[id];
  if (
    !item ||
    list.includes(id) ||
    !Number.isFinite(price) ||
    meta.wallet < price
  )
    return false;
  meta.wallet -= price;
  list.push(id);
  return true;
}
export function claimMission(meta, id) {
  const mission = missions.find((m) => m.id === id);
  if (
    !mission ||
    meta.claimed.includes(id) ||
    (meta[mission.key] || 0) < mission.target
  )
    return false;
  meta.claimed.push(id);
  meta.wallet += mission.reward;
  return true;
}
