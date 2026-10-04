import { maps } from "./config.js";

// The lobby and the battlefield use the same palette and prop placement.
export const mapThemes = [
  {
    ground: "#a9c878",
    terrainUrl: new URL("../assets/ground-sunny.webp", import.meta.url).href,
    roadUrl: new URL("../assets/road-sunny.webp", import.meta.url).href,
    previewUrl: new URL("../assets/preview-sunny.webp", import.meta.url).href,
    decor: ["s-parasol", "s-flowers", "s-olive"],
    road: "#efd398",
    edge: "#789854",
    pad: "#e6efb7",
    accent: "#699744",
  },
  {
    ground: "#263b54",
    terrainUrl: new URL("../assets/ground-market.webp", import.meta.url).href,
    roadUrl: new URL("../assets/road-market.webp", import.meta.url).href,
    previewUrl: new URL("../assets/preview-market.webp", import.meta.url).href,
    decor: ["s-lantern", "s-stall", "s-jars"],
    road: "#7790a0",
    edge: "#b0a8cf",
    pad: "#a1bac6",
    accent: "#ffd37b",
  },
  {
    ground: "#c1b15b",
    terrainUrl: new URL("../assets/ground-cheese.webp", import.meta.url).href,
    roadUrl: new URL("../assets/road-cheese.webp", import.meta.url).href,
    previewUrl: new URL("../assets/preview-cheese.webp", import.meta.url).href,
    decor: ["s-wheels", "s-mill", "s-cheese-rocks"],
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
  const choices = mapThemes[index].decor;
  const objects = [];
  for (let row = -2; row <= 7; row++)
    for (let col = -2; col <= 6; col++) {
      const seed = Math.abs((col + 7) * 31 + (row + 8) * 47 + index * 23);
      if (seed % 5 === 0) continue;
      const x = col * 90 + 30 + (seed % 19) - 9;
      const y = row * 78 + 26 + ((seed * 3) % 17) - 8;
      const id = choices[seed % choices.length];
      const width = 42 + (seed % 12);
      const height = width;
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
