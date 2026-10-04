import { test, expect } from "@playwright/test";

function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

async function openKitchen(page, path = "/") {
  await page.goto(path);
  await expect(page.locator(".loading")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Открыть кухню", exact: true })
    .click();
  await expect(page.locator(".overlay")).toHaveCount(0);
}

// Existing version-2 checkpoints must remain usable after the React migration.
const checkpoint = (overrides) => ({
  v: 2,
  map: 0,
  diff: 0,
  money: 340,
  lives: 25,
  maxLives: 25,
  wave: 0,
  kills: 0,
  leaks: 0,
  endless: false,
  perks: {},
  nextPerk: 4,
  perkChoices: [],
  cool: { bomb: 0, freeze: 0, trap: 0, rally: 0, repair: 0 },
  towers: [
    { pad: 0, type: 0, level: 1, branch: -1, kills: 0, spent: 65, priority: 0 },
  ],
  ...overrides,
});

async function restore(page, save) {
  await page.addInitScript(
    (save) => localStorage.setItem("pizzaSaveV2", JSON.stringify(save)),
    save,
  );
  await page.goto("/");
  await expect(page.locator(".loading")).toHaveCount(0);
  await page.getByRole("button", { name: /^Продолжить ·/ }).click();
}

async function build(page, pad, recipe = "Пепперони") {
  await page.locator(`[data-pad="${pad}"]`).press("Enter");
  await page
    .getByRole("button", { name: `Выбрать ${recipe}`, exact: true })
    .click();
  await page.getByRole("button", { name: /^Поставить ·/ }).click();
}

test("mobile: build, upgrade, sell, pause, ability, combat and reload", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await openKitchen(page);
  await expect(page.locator("#money")).toHaveText("340");
  await build(page, 0);
  await expect(page.locator("#money")).toHaveText("275");
  await expect(page.locator(".tower")).toHaveCount(1);
  await page.locator('[data-tower="0"]').press("Enter");
  await page.getByRole("button", { name: /^Улучшить до 2/ }).click();
  await expect(page.getByText("Уровень 2 из 5")).toBeVisible();
  await expect(page.locator("#money")).toHaveText("210");
  await page.getByRole("button", { name: "Продать · 84", exact: true }).click();
  await expect(page.locator(".tower")).toHaveCount(0);
  await expect(page.locator("#money")).toHaveText("294");
  await build(page, 0);
  await page.getByRole("button", { name: "Волна 1", exact: true }).click();
  await expect(page.locator(".enemy").first()).toBeVisible();
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  const transforms = await page
    .locator(".enemy")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("transform")),
    );
  await page.waitForTimeout(300);
  expect(
    await page
      .locator(".enemy")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("transform")),
      ),
  ).toEqual(transforms);
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.getByRole("button", { name: "Лёд", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Лёд", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "×1", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "×2", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => Number(await page.locator("#money").textContent()), {
      timeout: 20_000,
    })
    .toBeGreaterThan(229);
  await page.reload();
  await expect(page.locator(".loading")).toHaveCount(0);
  await page.getByRole("button", { name: /^Продолжить ·/ }).click();
  await expect(page.locator(".tower")).toHaveCount(1);
  await expect(page.locator("#wave")).toHaveText("0 / 18");
  await expect(page.locator("#money")).toHaveText("229");
  expect(errors).toEqual([]);
});

test("classic map, specialization and all menus", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await expect(page.locator(".loading")).toHaveCount(0);
  await page.getByRole("button", { name: /Ночной рынок/ }).click();
  await page.getByRole("button", { name: /Классика/ }).click();
  await page
    .getByRole("button", { name: "Открыть кухню", exact: true })
    .click();
  await expect(page.locator(".maptag")).toContainText("НОЧНОЙ РЫНОК");
  await expect(page.locator("#wave")).toHaveText("0 / 24");
  await build(page, 0);
  await page.locator('[data-tower="0"]').press("Enter");
  await page.getByRole("button", { name: /^Улучшить до 2/ }).click();
  await page.getByRole("button", { name: /^Острый край/ }).click();
  await expect(page.getByText("Уровень 3 из 5 · Острый край")).toBeVisible();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  for (const [button, heading, close] of [
    ["Разведка", "Обычная доставка", "На кухню"],
    ["Помощь", "Всё просто", "Понятно"],
    ["Награды", "Вкусные награды", "Назад"],
  ]) {
    if (button === "Помощь" || button === "Награды")
      await page
        .getByRole("button", { name: "Меню игры", exact: true })
        .click();
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await page.getByRole("button", { name: close, exact: true }).click();
  }
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  const sound = page.getByRole("switch", { name: "Звуки кухни", exact: true });
  await sound.click();
  await expect(sound).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pizzaPrefs")).sound,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("version-2 save: perks, final wave and endless delivery", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await restore(
    page,
    checkpoint({
      wave: 18,
      perkChoices: ["cash", "health", "damage"],
      nextPerk: 20,
    }),
  );
  await page.getByRole("button", { name: /Чаевые шефу/ }).click();
  await expect(page.locator("#money")).toHaveText("480");
  await expect(page.locator("#wave")).toHaveText("18 / ∞");
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await page
    .getByRole("button", { name: "Выбрать карту и начать заново", exact: true })
    .click();
  await page.getByRole("button", { name: "Вернуться", exact: true }).click();
  await expect(page.locator("#wave")).toHaveText("18 / ∞");
  expect(errors).toEqual([]);
});

test("release works under a subdirectory and serves no original source", async ({
  page,
  request,
}) => {
  const errors = watchErrors(page);
  await openKitchen(page, "/pizza/");
  await build(page, 0, "Моцарелла");
  await expect(page.locator("#money")).toHaveText("250");
  expect(
    await page.evaluate(() =>
      Array.from(document.images).every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
    ),
  ).toBe(true);
  for (const path of [
    "src/App.jsx",
    "js/game.js",
    "PizzaGame-source.zip",
    "package.json",
  ]) {
    expect((await request.get(`/pizza/${path}`)).status()).toBe(404);
  }
  const box = await page.locator(".app").boundingBox();
  expect(box.height).toBe(844);
  expect(errors).toEqual([]);
});

test("wave completion offers a perk", async ({ page }) => {
  const errors = watchErrors(page);
  const towers = Array.from({ length: 12 }, (_, pad) => ({
    pad,
    type: 0,
    level: 5,
    branch: 1,
    kills: 0,
    spent: 450,
    priority: 0,
  }));
  await restore(page, checkpoint({ wave: 3, towers }));
  await page.clock.install();
  await page.clock.pauseAt(
    await page.evaluate(() => new Date(Date.now() + 1000).toISOString()),
  );
  await page.getByRole("button", { name: "Волна 4", exact: true }).click();
  await page.clock.runFor(60_000);
  await expect(
    page.getByRole("heading", { name: "Добавим изюминку?" }),
  ).toBeVisible();
  await page.locator(".perk").first().click();
  await expect(page.locator(".overlay")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pizzaSaveV2")).wave,
    ),
  ).toBe(4);

  expect(errors).toEqual([]);
});

test("final delivery leads to victory and endless mode", async ({ page }) => {
  const errors = watchErrors(page);
  const towers = Array.from({ length: 12 }, (_, pad) => ({
    pad,
    type: 0,
    level: 5,
    branch: 1,
    kills: 0,
    spent: 450,
    priority: 0,
  }));
  await restore(
    page,
    checkpoint({ wave: 17, towers, perks: { damage: 10 }, nextPerk: 20 }),
  );
  await page.clock.install();
  await page.clock.pauseAt(
    await page.evaluate(() => new Date(Date.now() + 1000).toISOString()),
  );
  await page.getByRole("button", { name: "Волна 18", exact: true }).click();
  await page.clock.runFor(90_000);
  await expect(
    page.getByRole("heading", { name: "Пиццерия спасена!" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Бесконечная доставка", exact: true })
    .click();
  await expect(page.locator("#wave")).toHaveText("18 / ∞");
  expect(errors).toEqual([]);
});

test("defeat clears the checkpoint and permits a fresh run", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await restore(
    page,
    checkpoint({
      lives: 1,
      wave: 10,
      nextPerk: 12,
      towers: [
        {
          pad: 0,
          type: 6,
          level: 1,
          branch: -1,
          kills: 0,
          spent: 95,
          priority: 0,
        },
      ],
    }),
  );
  await page.clock.install();
  await page.clock.pauseAt(
    await page.evaluate(() => new Date(Date.now() + 1000).toISOString()),
  );
  await page.getByRole("button", { name: "Волна 11", exact: true }).click();
  await page.clock.runFor(60_000);
  await expect(
    page.getByRole("heading", { name: "Попробуем ещё раз?" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("pizzaSaveV2")),
  ).toBeNull();
  await page.getByRole("button", { name: "Новый забег", exact: true }).click();
  await page
    .getByRole("button", { name: "Открыть кухню", exact: true })
    .click();
  await expect(page.locator("#lives")).toHaveText("25");
  await expect(page.locator(".tower")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("failed atlas load shows retry and reload recovers", async ({ page }) => {
  await page.route("**/assets/ammo-atlas-*.png", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByText("Не удалось загрузить игру.")).toBeVisible();
  await page.unroute("**/assets/ammo-atlas-*.png");
  await page
    .getByRole("button", { name: "Попробовать снова", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Открыть кухню", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".loading")).toHaveCount(0);
});
