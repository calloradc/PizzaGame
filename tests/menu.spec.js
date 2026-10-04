import { test, expect } from "@playwright/test";
async function lobby(page) {
  await page.goto("/");
  await expect(page.locator(".loading")).toHaveCount(0);
}
async function finishAd(page) {
  await page.clock.runFor(7000);
  await page
    .getByRole("button", { name: "Забрать награду", exact: true })
    .click();
}

test("map previews match battlefield paths and ground palettes; HUD is centered", async ({
  page,
}) => {
  await lobby(page);
  const filters = [];
  for (let index = 0; index < 3; index++) {
    if (index) {
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
    await page.locator(".map-choices .choice").nth(index).click();
    const preview = await page
      .locator(".map-stage .map-preview")
      .evaluate((el) => ({
        path: el.querySelector("g > path").getAttribute("d"),
        filter: getComputedStyle(el.querySelector("image")).filter,
        road: el.querySelector("g > path:nth-child(2)").getAttribute("stroke"),
      }));
    await page
      .getByRole("button", { name: "Открыть кухню", exact: true })
      .click();
    await expect(page.locator("#road")).toHaveAttribute("d", preview.path);
    await expect(page.locator("#road")).toHaveAttribute("stroke", preview.road);
    expect(
      await page
        .locator(".world-ground")
        .evaluate((el) => getComputedStyle(el).filter),
    ).toBe(preview.filter);
    filters.push(preview.filter);
    const hud = await page.locator(".stats").boundingBox();
    expect(
      Math.abs(hud.x + hud.width / 2 - page.viewportSize().width / 2),
    ).toBeLessThan(1);
    expect(
      await page
        .locator(".pad .build-ring")
        .first()
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("pad-orbit");
    expect(
      await page
        .locator(".pad-base")
        .first()
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
  }
  expect(new Set(filters).size).toBe(3);
});

test("custom language list works with keyboard and removes vibration settings", async ({
  page,
}) => {
  await lobby(page);
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await expect(page.locator("select")).toHaveCount(0);
  await expect(page.getByRole("switch", { name: "Вибрация" })).toHaveCount(0);
  await page.locator("#language").focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await page.locator("#language").click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Make it comfortable" }),
  ).toBeVisible();
});

test("lobby reward and advertised item unlock persist; canceled unlock pays nothing", async ({
  page,
}) => {
  await page.clock.install();
  await lobby(page);
  await page.clock.pauseAt(
    await page.evaluate(() => new Date(Date.now() + 1000).toISOString()),
  );
  await page.getByRole("button", { name: "Забрать", exact: true }).click();
  await finishAd(page);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pizzaMeta")).wallet,
    ),
  ).toBe(230);
  await expect(page.locator(".lobby")).toBeVisible();
  await page.getByRole("button", { name: "Магазин", exact: true }).click();
  await page
    .getByRole("button", { name: "Открыть за просмотр", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Закрыть без награды", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pizzaMeta")).unlockedTowers,
    ),
  ).not.toContain(2);
  await page
    .getByRole("button", { name: "Открыть за просмотр", exact: true })
    .click();
  await finishAd(page);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("pizzaMeta")),
  );
  expect(saved.wallet).toBe(230);
  expect(saved.unlockedTowers).toContain(2);
  await page.reload();
  await page.getByRole("button", { name: "Магазин", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Открыть за просмотр", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pizzaMeta")).unlockedTowers,
    ),
  ).toContain(2);
});

test("battle ad repair and recharge pay once per wave and preserve their limits on reload", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("pizzaSaveV2")) return;
    localStorage.setItem(
      "pizzaSaveV2",
      JSON.stringify({
        v: 2,
        map: 0,
        diff: 0,
        money: 340,
        lives: 12,
        maxLives: 25,
        wave: 1,
        kills: 0,
        leaks: 0,
        mode: "campaign",
        runId: "ad-ui-test",
        cool: { bomb: 30, freeze: 38 },
        perks: {},
        nextPerk: 4,
        perkChoices: [],
        towers: [],
      }),
    );
  });
  await page.clock.install();
  await lobby(page);
  await page.getByRole("button", { name: /^Продолжить ·/ }).click();
  await page.clock.pauseAt(
    await page.evaluate(() => new Date(Date.now() + 1000).toISOString()),
  );
  await page.getByRole("button", { name: "Подарки", exact: true }).click();
  await page
    .getByRole("button", { name: "Пополнить жизни", exact: true })
    .click();
  await finishAd(page);
  await expect(page.locator("#lives")).toHaveText("17");
  await page.getByRole("button", { name: "Подарки", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Пополнить жизни", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Перезарядить силы", exact: true })
    .click();
  await finishAd(page);
  await expect(
    page.getByRole("button", { name: "Соус", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Лёд", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await page.getByRole("button", { name: /^Продолжить ·/ }).click();
  await page.getByRole("button", { name: "Подарки", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Пополнить жизни", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Перезарядить силы", exact: true }),
  ).toBeDisabled();
  await expect(page.locator("#lives")).toHaveText("17");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pizzaSaveV2")).adRechargeWave,
    ),
  ).toBe(1);
});
