import { test, expect } from "@playwright/test";

const tower = (pad, type, level = 1) => ({
  pad,
  type,
  level,
  branch: -1,
  kills: 0,
  spent: 95,
  priority: 0,
});
async function restore(page, overrides = {}) {
  await page.clock.install();
  await page.addInitScript(
    (save) => {
      localStorage.setItem("pizzaSaveV2", JSON.stringify(save));
      localStorage.setItem(
        "pizzaPrefs",
        JSON.stringify({ sound: false, fx: true, auto: false }),
      );
    },
    {
      v: 2,
      map: 0,
      diff: 1,
      money: 800,
      lives: 999,
      maxLives: 999,
      wave: 8,
      kills: 0,
      leaks: 0,
      endless: true,
      perks: {},
      nextPerk: 100,
      perkChoices: [],
      cool: { bomb: 0, freeze: 0, trap: 0, rally: 0, repair: 0 },
      towers: [tower(1, 2)],
      ...overrides,
    },
  );
  await page.goto("/");
  await page.getByRole("button", { name: /^Продолжить ·/ }).click();
  await page.clock.pauseAt(
    await page.evaluate(() => new Date(Date.now() + 1000).toISOString()),
  );
}
async function advanceUntil(page, predicate, limit = 30_000, step = 250) {
  for (let elapsed = 0; elapsed < limit; elapsed += step) {
    if (await predicate()) return;
    await page.clock.runFor(step);
  }
  expect(
    await predicate(),
    "Expected combat event within simulated time",
  ).toBeTruthy();
}

test("basil poison keeps enemy artwork visible; towers mirror both ways", async ({
  page,
}) => {
  await restore(page);
  await page.getByRole("button", { name: "Волна 9", exact: true }).click();
  const gun = page.locator('[data-tower="1"]');
  await advanceUntil(
    page,
    async () => (await gun.getAttribute("data-facing")) === "-1",
  );
  const poisoned = page.locator('.enemy[data-poisoned="true"]').first();
  await advanceUntil(page, async () => (await poisoned.count()) > 0);
  const enemy = await poisoned.elementHandle();
  const initialHealth = await enemy.evaluate((node) =>
    Number(node.querySelector('rect[fill="#eafaac"]').getAttribute("width")),
  );
  await page.clock.runFor(200);
  expect(
    await enemy.evaluate(
      (node) => node.querySelector(".enemy-art").style.filter,
    ),
  ).not.toContain("enemyHit");
  expect(
    await enemy.evaluate((node) =>
      Number(node.querySelector('rect[fill="#eafaac"]').getAttribute("width")),
    ),
  ).toBeLessThan(initialHealth);
  await advanceUntil(
    page,
    async () => (await gun.getAttribute("data-facing")) === "1",
  );
  const filter = await page
    .locator("#enemyHit feFlood")
    .getAttribute("flood-opacity");
  expect(Number(filter)).toBeLessThan(1);
});

test("dough splits into two moving crumbs and animated halves", async ({
  page,
}) => {
  await restore(page, {
    wave: 5,
    towers: [{ ...tower(0, 5, 5), priority: 1 }],
    perks: { damage: 10 },
  });
  await page.getByRole("button", { name: "Волна 6", exact: true }).click();
  await advanceUntil(
    page,
    async () => (await page.locator(".dough-half").count()) === 2,
    20_000,
    100,
  );
  await expect(page.locator('.enemy[data-species="crumb"]')).toHaveCount(2);
  const halves = await page
    .locator(".dough-half")
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("transform")));
  await page.clock.runFor(150);
  expect(
    await page
      .locator(".dough-half")
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("transform"))),
  ).not.toEqual(halves);
});

for (const [wave, type, name] of [
  [6, "boss", "Корочка"],
  [12, "moldboss", "Споровый барон"],
  [18, "chiliboss", "Шеф Чили"],
  [24, "general", "Генерал Томат"],
]) {
  test(`boss wave ${wave}: ${name}, telegraphed skill and distinct behavior`, async ({
    page,
  }) => {
    await restore(page, { wave: wave - 1, towers: [tower(0, 6), tower(1, 6)] });
    await page
      .getByRole("button", { name: `Волна ${wave}`, exact: true })
      .click();
    const boss = page.locator(`.enemy[data-species="${type}"]`);
    await advanceUntil(page, async () => (await boss.count()) === 1);
    await page.clock.runFor(300);
    await expect(page.locator(".bossbar")).toHaveAttribute("data-boss", type);
    await advanceUntil(
      page,
      async () => (await boss.getAttribute("data-casting")) === "true",
      10_000,
      100,
    );
    await page.clock.runFor(950);
    await expect(boss).toHaveAttribute("data-skill-count", "1");
    if (type === "boss") {
      await expect(page.locator(".enemy.summoned")).toHaveCount(2);
    } else if (type === "moldboss") {
      expect(
        await page
          .locator('.enemy:not(.boss-enemy) rect[fill="#b2f1ee"]')
          .count(),
      ).toBeGreaterThan(0);
    } else if (type === "chiliboss") {
      expect(
        await page.locator('.tower[data-stunned="true"]').count(),
      ).toBeGreaterThan(0);
    } else {
      await expect(boss.locator('rect[fill="#b2f1ee"]')).toHaveAttribute(
        "width",
        "34.0",
      );
    }
  });
}

test("idle and paused gameplay stop requesting animation frames; cooldowns still progress", async ({
  page,
}) => {
  await restore(page, {
    wave: 0,
    lives: 900,
    towers: [tower(0, 0)],
    cool: { repair: 5 },
  });
  // Wrap the already-installed virtual clock; installing it replaces native RAF.
  await page.evaluate(() => {
    window.animationFrames = 0;
    const original = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      original((time) => {
        window.animationFrames++;
        callback(time);
      });
  });
  await page.getByRole("button", { name: "Способности", exact: true }).click();
  const repair = page.getByRole("button", { name: "Ремонт", exact: true });
  await expect(repair).toBeDisabled();
  await page.clock.runFor(6000);
  await expect(repair).toBeEnabled();
  const before = await page.evaluate(() => window.animationFrames);
  await page.clock.runFor(2000);
  expect(await page.evaluate(() => window.animationFrames)).toBe(before);
  await page.getByRole("button", { name: "Волна 1", exact: true }).click();
  await page.clock.runFor(2000);
  expect(await page.evaluate(() => window.animationFrames)).toBeGreaterThan(
    before,
  );
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await page.clock.runFor(100);
  const paused = await page.evaluate(() => window.animationFrames);
  await page.clock.runFor(2000);
  expect(await page.evaluate(() => window.animationFrames)).toBe(paused);
});
