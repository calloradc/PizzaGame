import { test, expect } from "@playwright/test";

test("all three maps keep round pads and independent decorations clear of the road", async ({
  page,
}) => {
  await page.goto("/");
  for (let mapIndex = 0; mapIndex < 3; mapIndex++) {
    if (mapIndex > 0) {
      await page
        .getByRole("button", { name: "Настройки", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: "Выбрать карту и начать заново",
          exact: true,
        })
        .click();
    }
    await page
      .locator(".choices")
      .first()
      .locator("button")
      .nth(mapIndex)
      .click();
    await page
      .getByRole("button", { name: "Открыть кухню", exact: true })
      .click();
    const geometry = await page.locator("#map").evaluate((map) => {
      const road = map.querySelector("#road");
      const points = [];
      for (let d = 0; d <= road.getTotalLength(); d += 2)
        points.push(road.getPointAtLength(d));
      const clearance = (x, y) =>
        Math.min(
          ...points.map((point) => Math.hypot(point.x - x, point.y - y)),
        );
      const pads = [...map.querySelectorAll(".pad")].map((pad) => {
        const { e: x, f: y } = pad.transform.baseVal.consolidate().matrix;
        return { x, y, road: clearance(x, y) };
      });
      const decorations = [...map.querySelectorAll(".scenery-prop")].map(
        (node) => {
          const x = Number(node.dataset.x),
            y = Number(node.dataset.y);
          const radius =
            Math.max(
              Number(node.getAttribute("width")),
              Number(node.getAttribute("height")),
            ) / 2;
          return {
            road: clearance(x, y) - radius,
            pad:
              Math.min(...pads.map((pad) => Math.hypot(pad.x - x, pad.y - y))) -
              radius,
          };
        },
      );
      return { pads, decorations };
    });
    expect(geometry.pads).toHaveLength(12);
    for (const pad of geometry.pads)
      expect(pad.road).toBeGreaterThanOrEqual(34.9);
    expect(geometry.decorations.length).toBeGreaterThan(10);
    for (const decoration of geometry.decorations) {
      expect(decoration.road).toBeGreaterThan(21);
      expect(decoration.pad).toBeGreaterThanOrEqual(24);
    }
  }
});
