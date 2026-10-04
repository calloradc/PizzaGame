import { maps } from "./config.js";

// The lobby and the battlefield use the same palette and prop placement.
export const mapThemes = [
  {
    ground: "#a9c878",
    filter: "saturate(.85) brightness(1.04)",
    road: "#efd398",
    edge: "#789854",
    pad: "#e6efb7",
    accent: "#699744",
  },
  {
    ground: "#263b54",
    filter: "sepia(.4) saturate(.7) hue-rotate(155deg) brightness(.44)",
    road: "#7790a0",
    edge: "#1c3146",
    pad: "#a1bac6",
    accent: "#ffd37b",
  },
  {
    ground: "#c1b15b",
    filter: "sepia(.65) saturate(1.05) hue-rotate(351deg) brightness(1.04)",
    road: "#f7e3ab",
    edge: "#96843e",
    pad: "#fff0ad",
    accent: "#e5ac43",
  },
];
const cache = new Map();
export function mapScenery(index) {
  if (cache.has(index)) return cache.get(index);
  const map = maps[index];
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", map.path);
  const route = [],
    length = path.getTotalLength();
  for (let d = 0; d <= length; d += 6) {
    const p = path.getPointAtLength(d);
    route.push([p.x, p.y]);
  }
  const choices =
    index === 1
      ? ["d-pot", "d-bench", "d-rocks", "d-fence", "d-mushrooms", "d-tree"]
      : index === 2
        ? ["d-daisy", "d-pot", "d-rocks", "d-mushrooms", "d-hedge"]
        : [
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
  const objects = [];
  for (let row = -2; row <= 7; row++)
    for (let col = -2; col <= 6; col++) {
      const seed = Math.abs((col + 7) * 31 + (row + 8) * 47 + index * 23);
      if (seed % 5 === 0) continue;
      const x = col * 90 + 30 + (seed % 19) - 9;
      const y = row * 78 + 26 + ((seed * 3) % 17) - 8;
      const id = choices[seed % choices.length];
      const width =
        id === "d-tree" ? 64 : id === "d-hedge" ? 58 : 38 + (seed % 10);
      const height = id === "d-tree" ? 78 : width;
      const clearance = Math.max(width, height) / 2;
      if (
        route.some(
          ([px, py]) => (px - x) ** 2 + (py - y) ** 2 < (clearance + 22) ** 2,
        )
      )
        continue;
      if (
        map.pads.some(
          ([px, py]) => (px - x) ** 2 + (py - y) ** 2 < (clearance + 24) ** 2,
        )
      )
        continue;
      if ((x - 365) ** 2 + (y - 375) ** 2 < 75 ** 2) continue;
      objects.push({ id, x, y, width, height });
    }
  objects.sort((a, b) => a.y - b.y);
  cache.set(index, objects);
  return objects;
}
