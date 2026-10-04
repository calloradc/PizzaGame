import { test, expect } from "@playwright/test";

test.use({
  hasTouch: true,
  isMobile: true,
  viewport: { width: 390, height: 844 },
});

async function start(page) {
  await page.goto("/");
  await expect(page.locator(".loading")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Открыть кухню", exact: true })
    .click();
  await expect(page.locator(".overlay")).toHaveCount(0);
}
const settle = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
async function touch(client, type, points) {
  await client.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: points.map((point, index) => ({ ...point, id: index + 1 })),
  });
}
async function pointOn(page, selector, x = 0, y = 0) {
  return page.locator(selector).evaluate(
    (node, { x, y }) => {
      const point = new DOMPoint(x, y).matrixTransform(node.getScreenCTM());
      return { x: point.x, y: point.y };
    },
    { x, y },
  );
}
const zoom = (page) =>
  page.locator(".scene-viewport").evaluate((node) => Number(node.dataset.zoom));

test("a map touch cannot activate the close button appearing under the finger", async ({
  page,
  context,
}) => {
  await start(page);
  const client = await context.newCDPSession(page);
  const pad = await pointOn(page, '[data-pad="0"]');
  await touch(client, "touchStart", [pad]);
  await touch(client, "touchEnd", []);
  await expect(page.locator(".sheet.open")).toBeVisible();
  const close = page.getByRole("button", { name: "Закрыть", exact: true });
  // Some touch browsers retarget the compatibility click to the new sheet.
  await close.dispatchEvent("click", {
    bubbles: true,
    detail: 1,
    clientX: pad.x,
    clientY: pad.y,
  });
  await expect(page.locator(".sheet.open")).toBeVisible();
  await close.tap();
  await expect(page.locator(".sheet.open")).toHaveCount(0);
  await client.detach();
});

test("fullscreen square world, native pan/tap separation and fixed HUD", async ({
  page,
  context,
}) => {
  await start(page);
  const scene = await page.locator(".scene-viewport").boundingBox();
  expect(scene).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
  const board = await page.locator(".camera-world").boundingBox();
  expect(board.width).toBeCloseTo(board.height, 4);
  await expect(page.locator("#map")).toHaveAttribute("viewBox", "0 0 450 450");
  await expect(page.locator("#rasterGround")).toHaveCount(0);
  await expect(page.locator(".camera-controls")).toHaveCount(0);
  expect(
    await page
      .locator(".world-ground")
      .evaluate((node) => getComputedStyle(node).backgroundImage),
  ).toMatch(/ground-sunny/);
  await expect(page.locator(".scenery-prop").first()).toHaveAttribute(
    "href",
    /^blob:/,
  );
  expect(
    await page
      .locator("#mapDecor")
      .evaluate((node) => getComputedStyle(node).display),
  ).not.toBe("none");
  const stats = await page.locator(".stats").boundingBox();
  const dock = await page.locator(".dock").boundingBox();
  const client = await context.newCDPSession(page);
  const pad = await pointOn(page, '[data-pad="0"]');
  await touch(client, "touchStart", [pad]);
  await touch(client, "touchMove", [{ x: pad.x + 40, y: pad.y + 35 }]);
  await touch(client, "touchEnd", []);
  await settle(page);
  expect((await page.locator(".camera-world").boundingBox()).x).toBeGreaterThan(
    board.x + 30,
  );
  await expect(page.locator(".sheet.open")).toHaveCount(0);
  await expect(page.locator(".scene-viewport")).not.toHaveClass(/dragging/);
  expect(await page.locator(".stats").boundingBox()).toEqual(stats);
  expect(await page.locator(".dock").boundingBox()).toEqual(dock);
  const movedPad = await pointOn(page, '[data-pad="0"]');
  await page.touchscreen.tap(movedPad.x, movedPad.y);
  await expect(page.locator(".sheet.open")).toBeVisible();
  await page.getByRole("button", { name: /^Поставить ·/ }).click();
  await expect(page.locator("#money")).toHaveText("275");
  await expect(page.locator(".tower")).toHaveCount(1);
  await page.locator(".tower").press("Enter");
  expect(
    await page
      .locator(".tower")
      .evaluate((node) => getComputedStyle(node).outlineStyle),
  ).toBe("none");
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  // Focusing a button in the floating sheet must not scroll the scene or its HUD.
  expect(await page.locator(".stats").boundingBox()).toEqual(stats);
  expect(await page.locator(".dock").boundingBox()).toEqual(dock);
  await page.getByRole("button", { name: "Волна 1", exact: true }).click();
  await expect(page.locator(".enemy").first()).toBeVisible();
  const banner = await page.locator(".banner.show").boundingBox();
  expect(banner.x).toBeGreaterThanOrEqual(0);
  expect(banner.x + banner.width).toBeLessThanOrEqual(scene.width);
  expect(await page.locator(".stats").boundingBox()).toEqual(stats);
  await client.detach();
});

test("real two-finger pinch keeps its focal point; limits and rotation without camera buttons", async ({
  page,
  context,
}) => {
  await start(page);
  const client = await context.newCDPSession(page);
  const logicalPoint = () =>
    page.locator("#world").evaluate((node) => {
      const point = new DOMPoint(170, 425).matrixTransform(
        node.getScreenCTM().inverse(),
      );
      return { x: point.x, y: point.y };
    });
  const before = await logicalPoint();
  await touch(client, "touchStart", [
    { x: 140, y: 425 },
    { x: 200, y: 425 },
  ]);
  await touch(client, "touchMove", [
    { x: 110, y: 425 },
    { x: 230, y: 425 },
  ]);
  await touch(client, "touchEnd", []);
  await settle(page);
  expect(await zoom(page)).toBeCloseTo(1.8, 1);
  const after = await logicalPoint();
  expect(after.x).toBeCloseTo(before.x, 1);
  expect(after.y).toBeCloseTo(before.y, 1);
  await expect(page.locator(".sheet.open")).toHaveCount(0);
  await page.mouse.move(195, 425);
  await page.mouse.wheel(0, -1800);
  await expect.poll(() => zoom(page)).toBe(1.8);
  for (let i = 0; i < 7; i++) {
    await page.mouse.wheel(0, 100);
    await settle(page);
  }
  await expect.poll(() => zoom(page)).toBe(0.9);
  await page.setViewportSize({ width: 844, height: 390 });
  await settle(page);
  const board = await page.locator(".camera-world").boundingBox();
  expect(board.width).toBeCloseTo(board.height, 4);
  expect(await page.locator(".scene-viewport").boundingBox()).toMatchObject({
    x: 0,
    y: 0,
    width: 844,
    height: 390,
  });
  expect(await zoom(page)).toBe(0.9);
  await client.detach();
});

test("ability aiming uses world coordinates after pan and zoom; canceled touches recover", async ({
  page,
  context,
}) => {
  await start(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const pad = await pointOn(page, '[data-pad="0"]');
  await page.touchscreen.tap(pad.x, pad.y);
  await page.getByRole("button", { name: /^Поставить ·/ }).click();
  const client = await context.newCDPSession(page);
  await touch(client, "touchStart", [{ x: 200, y: 400 }]);
  await touch(client, "touchMove", [{ x: 230, y: 430 }]);
  await touch(client, "touchCancel", []);
  await settle(page);
  await expect(page.locator(".scene-viewport")).not.toHaveClass(/dragging/);
  await page.mouse.move(195, 425);
  await page.mouse.wheel(0, -120);
  await settle(page);
  await page.getByRole("button", { name: "Волна 1", exact: true }).click();
  await expect(page.locator(".enemy").first()).toBeVisible();
  // This scenario exercises oil aiming; unlock it through the shop before casting.
  await page.getByRole("button", { name: "Меню игры", exact: true }).click();
  await page.getByRole("button", { name: "Магазин", exact: true }).click();
  await page.getByRole("button", { name: /^Способности 2\/7/ }).click();
  await page
    .getByRole("button", { name: "Открыть Масло", exact: true })
    .click();
  await page.getByRole("button", { name: "Назад", exact: true }).click();
  await page.getByRole("button", { name: "Масло", exact: true }).click();
  await expect(page.locator(".aimhint.on")).toBeVisible();
  await touch(client, "touchStart", [{ x: 200, y: 400 }]);
  await touch(client, "touchMove", [{ x: 220, y: 415 }]);
  await touch(client, "touchEnd", []);
  await settle(page);
  await expect(page.locator(".aimhint.on")).toBeVisible();
  await expect(page.locator('#effects ellipse[fill="#9b783d"]')).toHaveCount(0);
  const road = await pointOn(page, "#world", 116, 130);
  await page.touchscreen.tap(road.x, road.y);
  await expect(page.locator(".aimhint.on")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Масло", exact: true }),
  ).toBeDisabled();
  const trap = page.locator('#effects ellipse[fill="#9b783d"]');
  await expect(trap).toHaveCount(1);
  // Native taps round to physical screen pixels before the SVG inverse transform.
  expect(Math.abs(Number(await trap.getAttribute("cx")) - 116)).toBeLessThan(1);
  expect(Math.abs(Number(await trap.getAttribute("cy")) - 130)).toBeLessThan(1);
  expect(errors).toEqual([]);
  await client.detach();
});
