import { test, expect } from "@playwright/test";
async function lobby(page) {
  await page.goto("/");
  await expect(page.locator(".loading")).toHaveCount(0);
}
const meta = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("pizzaMeta")));
async function shop(page) {
  await page.getByRole("button", { name: "Магазин", exact: true }).click();
}

test("shop unlocks persist, prevents overspending, and missions can only be claimed once", async ({
  page,
}) => {
  await lobby(page);
  await shop(page);
  await expect(
    page.getByRole("button", { name: "Открыть Трюфель", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Открыть Базилик", exact: true })
    .click();
  await expect.poll(async () => (await meta(page)).wallet).toBe(50);
  await expect(
    page.getByRole("button", { name: "Открыть Базилик", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await shop(page);
  expect((await meta(page)).unlockedTowers).toContain(2);
  await page.getByRole("button", { name: "Назад", exact: true }).click();
  await page
    .getByRole("button", { name: "Открыть кухню", exact: true })
    .click();
  await page.locator('[data-pad="0"]').press("Enter");
  await page
    .getByRole("button", { name: "Выбрать Базилик", exact: true })
    .click();
  await page.getByRole("button", { name: /^Поставить ·/ }).click();
  await expect(page.locator(".tower")).toHaveCount(1);
  await page.reload();
  expect((await meta(page)).wallet).toBe(50);
});

test("simulated ad cancel pays nothing; completed ad pays once and has a persistent cooldown", async ({
  page,
}) => {
  await lobby(page);
  await shop(page);
  await page.getByRole("button", { name: "Забрать", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Забрать награду", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Закрыть без награды", exact: true })
    .click();
  expect((await meta(page)).wallet).toBe(150);
  await page.getByRole("button", { name: "Забрать", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Забрать награду", exact: true }),
  ).toBeEnabled({ timeout: 9000 });
  await page
    .getByRole("button", { name: "Забрать награду", exact: true })
    .click();
  await expect.poll(async () => (await meta(page)).wallet).toBe(230);
  await expect(
    page.getByRole("button", { name: /Снова через/ }),
  ).toBeDisabled();
  await page.reload();
  await shop(page);
  expect((await meta(page)).wallet).toBe(230);
  await expect(
    page.getByRole("button", { name: /Снова через/ }),
  ).toBeDisabled();
});

test("language and sliders persist and every visible menu uses English", async ({
  page,
}) => {
  await lobby(page);
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await page.locator("#language").selectOption("en");
  await expect(
    page.getByRole("heading", { name: "Make it comfortable" }),
  ).toBeVisible();
  await page.locator("#volume").fill("35");
  await page.locator("#quality").fill("20");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open kitchen", exact: true }),
  ).toBeVisible();
  expect(await page.locator(".lobby").innerText()).not.toMatch(/[а-яё]/i);
  await page.getByRole("button", { name: "Shop", exact: true }).click();
  expect(await page.locator(".modal").innerText()).not.toMatch(/[а-яё]/i);
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.locator("#volume")).toHaveValue("35");
  await expect(page.locator("#quality")).toHaveValue("20");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

for (const [mode, label, goal] of [
  ["blitz", "Блиц", "12"],
  ["survival", "Выживание", "∞"],
  ["daily", "Заказ дня", "12"],
])
  test(`mode ${mode} configures a real run`, async ({ page }) => {
    await lobby(page);
    await page.getByRole("button", { name: new RegExp(label) }).click();
    if (mode === "daily") {
      await expect(
        page.locator(".difficulty-choices .choice").nth(0),
      ).toBeDisabled();
      await expect(
        page.locator(".difficulty-choices .choice").nth(2),
      ).toBeDisabled();
    }
    await page
      .getByRole("button", { name: "Открыть кухню", exact: true })
      .click();
    await expect(page.locator("#wave")).toHaveText(`0 / ${goal}`);
    await expect
      .poll(async () =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem("pizzaSaveV2")).mode,
        ),
      )
      .toBe(mode);
    if (mode === "blitz")
      await expect(page.locator("#money")).toHaveText("470");
  });

test("right click, long hold, drag and key repeat do not select or purchase", async ({
  page,
}) => {
  await lobby(page);
  await page
    .getByRole("button", { name: "Открыть кухню", exact: true })
    .click();
  const pad = page.locator('[data-pad="0"]');
  await pad.click({ button: "right" });
  await expect(page.locator(".sheet.open")).toHaveCount(0);
  const box = await pad.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await expect(page.locator(".sheet.open")).toHaveCount(0);
  await pad.press("Enter");
  const build = page.getByRole("button", { name: /^Поставить ·/ });
  await build.click({ button: "right" });
  await expect(page.locator(".tower")).toHaveCount(0);
  const b = await build.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await expect(page.locator(".tower")).toHaveCount(0);
  await build.click();
  await expect(page.locator(".tower")).toHaveCount(1);
  await expect(page.locator("#money")).toHaveText("275");
  await page.locator(".tower").press("Enter");
  await page.getByRole("button", { name: /^Улучшить до 2/ }).focus();
  await page.keyboard.down("Enter");
  await expect(page.getByText("Уровень 2 из 5")).toBeVisible();
  await page.keyboard.down("Enter");
  await page.keyboard.up("Enter");
  await expect(page.getByText("Уровень 2 из 5")).toBeVisible();
  await expect(page.locator("#money")).toHaveText("210");
});

for (const size of [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
])
  test(`responsive ${size.width}×${size.height} keeps controls in bounds`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await lobby(page);
    for (const selector of [".lobby-top", ".run-setup", ".lobby-nav"]) {
      const box = await page.locator(selector).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width + 0.5);
    }
    await page
      .getByRole("button", { name: "Открыть кухню", exact: true })
      .click();
    await page.waitForTimeout(250);
    for (const selector of [".top", ".stats", ".dock"]) {
      const box = await page.locator(selector).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width + 0.5);
      expect(box.y + box.height).toBeLessThanOrEqual(size.height + 0.5);
    }
    const board = await page.locator(".camera-world").boundingBox();
    expect(board.width).toBeCloseTo(board.height, 3);
    await page.mouse.move(size.width / 2, size.height / 2);
    for (let i = 0; i < 9; i++) await page.mouse.wheel(0, 100);
    await expect
      .poll(() => page.locator(".scene-viewport").getAttribute("data-zoom"))
      .toBe("0.9000");
    await page.locator('[data-pad="0"]').press("Enter");
    await page.waitForTimeout(250);
    const sheet = await page.locator(".sheet.open").boundingBox();
    expect(sheet.x).toBeGreaterThanOrEqual(0);
    expect(sheet.x + sheet.width).toBeLessThanOrEqual(size.width + 0.5);
    expect(sheet.y).toBeGreaterThanOrEqual(0);
    expect(sheet.y + sheet.height).toBeLessThanOrEqual(size.height + 0.5);
  });

test("mission rewards cannot be collected twice after a reload", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "pizzaMeta",
      localStorage.getItem("pizzaMeta") ||
        JSON.stringify({ kills: 100, wallet: 150 }),
    ),
  );
  await lobby(page);
  await page.getByRole("button", { name: "Задания", exact: true }).click();
  const mission = page.locator(".mission").nth(1);
  await mission.getByRole("button").click();
  await expect.poll(async () => (await meta(page)).wallet).toBe(270);
  await expect(mission.getByRole("button")).toBeDisabled();
  await page.reload();
  await page.getByRole("button", { name: "Задания", exact: true }).click();
  await expect(
    page.locator(".mission").nth(1).getByRole("button"),
  ).toBeDisabled();
  expect((await meta(page)).wallet).toBe(270);
});

test("new towers fight new enemy types with armor shred and ally haste", async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript(() => {
    localStorage.setItem("pizzaPrefs", JSON.stringify({ fx: false }));
    localStorage.setItem(
      "pizzaSaveV2",
      JSON.stringify({
        v: 2,
        map: 0,
        diff: 0,
        wave: 9,
        money: 500,
        lives: 999,
        maxLives: 999,
        kills: 0,
        leaks: 0,
        endless: true,
        perks: {},
        nextPerk: 100,
        perkChoices: [],
        towers: [
          {
            pad: 0,
            type: 7,
            level: 1,
            branch: 0,
            kills: 0,
            spent: 125,
            priority: 0,
          },
          {
            pad: 1,
            type: 8,
            level: 1,
            branch: 1,
            kills: 0,
            spent: 175,
            priority: 0,
          },
          {
            pad: 7,
            type: 9,
            level: 1,
            branch: 0,
            kills: 0,
            spent: 210,
            priority: 0,
          },
        ],
      }),
    );
  });
  await lobby(page);
  await page.getByRole("button", { name: /^Продолжить ·/ }).click();
  await page.clock.pauseAt(
    await page.evaluate(() => new Date(Date.now() + 1000).toISOString()),
  );
  await page.getByRole("button", { name: "Волна 10", exact: true }).click();
  await page.clock.runFor(3500);
  await expect(page.locator('.enemy[data-shred="true"]').first()).toBeVisible();
  await page.clock.runFor(5000);
  for (const type of ["onion", "popcorn", "mint"])
    expect(
      await page.locator(`.enemy[data-species="${type}"]`).count(),
    ).toBeGreaterThan(0);
  for (
    let elapsed = 0;
    elapsed < 5000 &&
    !(await page.locator('.enemy[data-hasted="true"]').count());
    elapsed += 250
  )
    await page.clock.runFor(250);
  expect(
    await page.locator('.enemy[data-hasted="true"]').count(),
  ).toBeGreaterThan(0);
  for (const pad of [0, 1, 7])
    await expect(page.locator(`[data-tower="${pad}"]`)).toHaveAttribute(
      "data-facing",
      /1/,
    );
});

async function completeAd(page) {
  await page.clock.runFor(7000);
  await page
    .getByRole("button", { name: "Забрать награду", exact: true })
    .click();
}
test("ad supply pays once between waves", async ({ page }) => {
  await page.clock.install();
  await lobby(page);
  await page
    .getByRole("button", { name: "Открыть кухню", exact: true })
    .click();
  await page.clock.pauseAt(
    await page.evaluate(() => new Date(Date.now() + 1000).toISOString()),
  );
  await page.getByRole("button", { name: "Меню игры", exact: true }).click();
  await page.getByRole("button", { name: /Поставка \+100/ }).click();
  await completeAd(page);
  await expect(page.locator("#money")).toHaveText("440");
  await page.getByRole("button", { name: "Меню игры", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Поставка \+100/ }),
  ).toBeDisabled();
});

test("completed run and doubled reward survive reload without repeated payouts", async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript(() => {
    if (!localStorage.getItem("pizzaSaveV2"))
      localStorage.setItem(
        "pizzaSaveV2",
        JSON.stringify({
          v: 2,
          map: 0,
          diff: 0,
          wave: 18,
          money: 900,
          lives: 20,
          maxLives: 25,
          runId: "finished-test",
          runWallet: 100,
          finished: true,
          resultWin: true,
          kills: 80,
          leaks: 0,
          perks: {},
          nextPerk: 20,
          perkChoices: [],
          towers: [
            {
              pad: 0,
              type: 0,
              level: 1,
              branch: -1,
              kills: 0,
              spent: 65,
              priority: 0,
            },
          ],
        }),
      );
  });
  await lobby(page);
  await page
    .getByRole("button", { name: "Результаты забега", exact: true })
    .click();
  await page.clock.pauseAt(
    await page.evaluate(() => new Date(Date.now() + 1000).toISOString()),
  );
  await page.getByRole("button", { name: /Удвоить награду/ }).click();
  await completeAd(page);
  await expect.poll(async () => (await meta(page)).wallet).toBe(250);
  await expect(
    page.getByRole("button", { name: /Удвоить награду/ }),
  ).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("button", { name: "Результаты забега", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Удвоить награду/ }),
  ).toHaveCount(0);
  expect((await meta(page)).wallet).toBe(250);
});

test("ad revive restores lives and cannot revive a run twice", async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript(() =>
    localStorage.setItem(
      "pizzaSaveV2",
      JSON.stringify({
        v: 2,
        map: 0,
        diff: 2,
        wave: 0,
        money: 100,
        lives: 1,
        maxLives: 20,
        kills: 0,
        leaks: 0,
        endless: false,
        perks: {},
        nextPerk: 100,
        perkChoices: [],
        towers: [
          {
            pad: 10,
            type: 6,
            level: 1,
            branch: -1,
            kills: 0,
            spent: 95,
            priority: 0,
          },
        ],
      }),
    ),
  );
  await lobby(page);
  await page.getByRole("button", { name: /^Продолжить ·/ }).click();
  await page.clock.pauseAt(
    await page.evaluate(() => new Date(Date.now() + 1000).toISOString()),
  );
  await page.getByRole("button", { name: "Волна 1", exact: true }).click();
  await page.clock.runFor(60000);
  await page.getByRole("button", { name: /Вторая попытка/ }).click();
  await completeAd(page);
  await expect(page.locator("#lives")).toHaveText("8");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pizzaSaveV2")).revived,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Волна 1", exact: true }).click();
  await page.clock.runFor(60000);
  await expect(
    page.getByRole("heading", { name: "Попробуем ещё раз?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Вторая попытка/ }),
  ).toHaveCount(0);
});
