import { test, expect } from "@playwright/test";
test("A: general investor filters, arbitrary company, sources and individual export", async ({
  page,
}) => {
  await page.goto("/explore");
  await expect(
    page.getByTestId("result-count").filter({ visible: true }),
  ).toHaveText("Найдено: 503");
  await page.locator("select[name=pe]").selectOption("15");
  await page.locator("select[name=cap]").selectOption("100000000000");
  await page.getByRole("button", { name: "Применить" }).click();
  await expect(
    page.getByTestId("result-count").filter({ visible: true }),
  ).not.toHaveText("Найдено: 503");
  await page.goto("/company/MSFT");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("MSFT");
  await expect(
    page.getByText("Для MSFT загружены метрики общего набора."),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Research brief", exact: true }).click();
  expect((await download).suggestedFilename()).toBe(
    "MIRROR_X_MSFT_research.md",
  );
});
test("B: deterministic arbitrary non-focus ticker resolves facts or unsupported valuation", async ({
  page,
  request,
}) => {
  const response = await request.get(
    "/api/screen?sort=ticker&page=4&pageSize=25",
  );
  const json = await response.json();
  const top = await (
    await request.get("/api/screen?sort=score&pageSize=10")
  ).json();
  const exclude = new Set([
    ...top.rows.map((r: { ticker: string }) => r.ticker),
    "ADBE",
    "PYPL",
    "NKE",
  ]);
  const c = json.rows.find((r: { ticker: string }) => !exclude.has(r.ticker));
  expect(c).toBeTruthy();
  expect([...exclude]).not.toContain(c.ticker);
  expect(["ADBE", "PYPL", "NKE"]).not.toContain(c.ticker);
  await page.goto(`/company/${c.ticker}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(c.ticker);
  await page.goto(`/valuation/${c.ticker}`);
  await expect(
    page.getByRole("heading", {
      name: "Для этой компании нет проверяемой FCFF-модели",
    }),
  ).toBeVisible();
});
test("C: coverage and server pagination are consistent", async ({
  request,
}) => {
  const health = await (await request.get("/api/health")).json();
  const all = [];
  for (let p = 1; p <= 6; p++) {
    const j = await (
      await request.get(`/api/screen?page=${p}&pageSize=100`)
    ).json();
    all.push(...j.rows);
  }
  expect(all.length).toBe(health.coverage.instruments);
  expect(new Set(all.map((c) => c.ticker)).size).toBe(503);
  expect(health.coverage.datedPrices).toBe(0);
  const empty = await (await request.get("/api/screen?dated=1")).json();
  expect(empty.total).toBe(0);
});
test("D: contest isolated and FINAL export blocked", async ({
  page,
  request,
}) => {
  const before = await (await request.get("/api/screen")).json();
  await page.goto("/challenge/freedom-2026");
  await expect(
    page.getByText("PRELIMINARY · НЕ ГОТОВО К СДАЧЕ", { exact: true }),
  ).toBeVisible();
  const after = await (await request.get("/api/screen")).json();
  expect(after.total).toBe(before.total);
  const denied = await request.get("/api/export/xlsx?final=1");
  expect(denied.status()).toBe(409);
  expect((await request.get("/api/export/xlsx")).status()).toBe(200);
  expect((await request.get("/api/export/pptx")).status()).toBe(200);
});
test("valuation recalculates, reverse solves and local scenario restores", async ({
  page,
}) => {
  await page.goto("/valuation/ADBE");
  const original = await page.getByTestId("fair-value").textContent();
  await page.getByRole("slider", { name: "WACC", exact: true }).fill("12");
  await expect(page.getByTestId("fair-value")).not.toHaveText(original!);
  await page.getByRole("button", { name: "Сохранить сценарий" }).click();
  await expect(
    page.getByText("Сценарий сохранён в этом браузере", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Сбросить допущения" }).click();
  await expect(page.getByTestId("fair-value")).toHaveText(original!);
  await page.getByRole("button", { name: "Восстановить сохранённый" }).click();
  await expect(page.getByTestId("fair-value")).not.toHaveText(original!);
  await page
    .getByRole("spinbutton", { name: "Цена для Reverse DCF" })
    .fill("250");
  await expect(page.locator(".reverse-output strong")).not.toHaveText("N/A");
});
test("watchlist note persists across reload and delete works", async ({
  page,
}) => {
  await page.goto("/company/ADBE");
  await page.getByRole("button", { name: "В мои исследования" }).click();
  await page.goto("/watchlist");
  await page
    .getByRole("textbox", { name: "Мой тезис и заметки" })
    .fill("Проверить AI ARR");
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Мой тезис и заметки" }),
  ).toHaveValue("Проверить AI ARR");
  await page.getByRole("button", { name: "Удалить ADBE" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Ваш следующий аргумент начинается здесь",
    }),
  ).toBeVisible();
});
test("mobile 390px and desktop 1366px have no page overflow or JS errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [390, 1366]) {
    await page.setViewportSize({ width, height: 850 });
    for (const route of [
      "/",
      "/explore",
      "/company/ADBE",
      "/valuation/ADBE",
      "/challenge/freedom-2026",
      "/compare",
    ]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${width}: ${route}`,
      ).toBe(true);
    }
    await page.goto("/");
    await page.screenshot({
      path: `test-results/home-${width}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
test("API validates input and unsupported ticker is a true 404", async ({
  request,
  page,
}) => {
  expect((await request.get("/api/screen?page=-1")).status()).toBe(400);
  expect((await request.get("/api/screen?pageSize=100000")).status()).toBe(400);
  expect((await request.get("/api/company/NOTATICKER/brief")).status()).toBe(
    404,
  );
  const response = await page.goto("/company/NOTATICKER");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Компания или страница не найдена" }),
  ).toBeVisible();
});
