import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
async function fixture() {
  const wb = new ExcelJS.Workbook();
  const s = wb.addWorksheet("Prices");
  s.addRow(["ticker", "date", "open", "high", "low", "close", "volume"]);
  // Synthetic fixture, never presented as production market history.
  for (const [ticker, offset] of [
    ["TESTA", 0],
    ["TESTB", 100],
  ] as const)
    for (let i = 0; i < 65; i++) {
      const date = new Date(Date.UTC(2026, 0, 1 + i))
        .toISOString()
        .slice(0, 10);
      const close = 100 + offset + i;
      s.addRow([
        ticker,
        date,
        close - 1,
        close + 3,
        close - 2,
        close,
        1000 + i,
      ]);
    }
  const p = wb.addWorksheet("Positions");
  p.addRow(["ticker", "quantity", "averageCost", "sector"]);
  p.addRow(["TESTA", 10, 100, "Test"]);
  p.addRow(["TESTB", 5, 210, "Test"]);
  const f = wb.addWorksheet("Financials");
  f.addRow([
    "ticker",
    "periodEnd",
    "revenue",
    "operatingIncome",
    "cash",
    "debt",
    "source",
  ]);
  f.addRow([
    "MYCO",
    "2024-12-31",
    100000,
    20000,
    30000,
    10000,
    "Synthetic accounting fixture",
  ]);
  f.addRow([
    "MYCO",
    "2025-12-31",
    150000,
    35000,
    40000,
    8000,
    "Synthetic accounting fixture",
  ]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
test("market visualization filters, data access and company charts", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/market");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Рынок в одной картине",
  );
  await expect(page.getByTestId("market-count")).toContainText("503");
  const mapBox = await page
    .getByRole("heading", { name: "Карта крупнейших отраслей" })
    .boundingBox();
  const chartBox = await page.locator(".chart-host").first().boundingBox();
  expect(chartBox!.y).toBeGreaterThan(mapBox!.y + mapBox!.height);
  await page.getByLabel("Поиск компании").fill("MSFT");
  await expect(page.getByTestId("market-count")).toHaveText("1 компаний");
  await page.getByLabel("Поиск компании").fill("");
  await page.getByLabel("Сектор", { exact: true }).selectOption({ index: 1 });
  await expect(page.getByTestId("market-count")).not.toHaveText("503 компаний");
  await page.goto("/company/ADBE");
  await expect(
    page.getByRole("heading", { name: "ADBE · бизнес в цифрах" }),
  ).toBeVisible();
  await expect(page.locator(".recharts-surface").first()).toBeVisible();
  expect(errors).toEqual([]);
});
test("XLSX preview → candles → portfolio → business → export → reload → repeat import refused", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/workspace");
  await page
    .getByLabel("Источник данных", { exact: true })
    .fill("Synthetic browser test fixture");
  await page.getByLabel("Выбрать Excel или CSV").setInputFiles({
    name: "fixture.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await fixture(),
  });
  await expect(
    page.getByRole("heading", { name: "Проверьте перед применением" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "TESTA · история торгов" }),
  ).not.toBeVisible();
  await page
    .getByRole("button", { name: "Добавить без перезаписи", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "TESTA · история торгов" }),
  ).toBeVisible();
  await page.getByLabel("Тип графика").selectOption("candles");
  await expect(page.locator("svg.candles")).toBeVisible();
  await page.getByRole("button", { name: "Портфель", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Распределение по активам" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Мой бизнес", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "MYCO · выручка и рентабельность" }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Выгрузить Excel с графиком" })
    .click();
  expect((await download).suggestedFilename()).toBe("MIRROR_X_workspace.xlsx");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "TESTA · история торгов" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Файлы и облако" }).click();
  await page
    .getByLabel("Источник данных", { exact: true })
    .fill("Synthetic browser test fixture");
  await page.getByLabel("Выбрать Excel или CSV").setInputFiles({
    name: "fixture.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await fixture(),
  });
  await page
    .getByRole("button", { name: "Добавить без перезаписи", exact: true })
    .click();
  await expect(page.locator(".form-error[role=alert]")).toContainText("Повтор");
  expect(errors).toEqual([]);
});
test("bad imports fail without modifying current workspace; HTTP guards and disabled AI", async ({
  page,
  request,
}) => {
  await page.goto("/workspace");
  await page.getByLabel("Источник данных", { exact: true }).fill("Test");
  await page.getByLabel("Выбрать Excel или CSV").setInputFiles({
    name: "invalid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("ticker,date,close\nTESTA,2026-02-30,-4"),
  });
  await expect(page.locator(".form-error[role=alert]")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Проверьте перед применением" }),
  ).not.toBeVisible();
  expect(
    (
      await request.post(
        "/api/spreadsheets/import?filename=x.csv&source=Test",
        { data: "ticker,date,close\nA,2026-01-01,1" },
      )
    ).status(),
  ).toBe(403);
  const status = await (await request.get("/api/assistant")).json();
  expect(status).toEqual({ configured: false, dailyLimit: 10 });
  const ai = await page.evaluate(async () => {
    const r = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "Hello world", tickers: [] }),
    });
    return r.status;
  });
  expect(ai).toBe(503);
  const template = await request.get("/api/spreadsheets/template");
  expect(template.status()).toBe(200);
  expect(template.headers()["content-type"]).toContain("spreadsheetml");
});
test("new pages and populated charts fit 390/1366 with no JS errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [390, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/market", "/workspace"]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${width} ${route}`,
      ).toBe(true);
      await page.screenshot({
        path: `test-results/${route.slice(1)}-${width}.png`,
        fullPage: true,
      });
    }
  }
  await page
    .getByLabel("Источник данных", { exact: true })
    .fill("Synthetic layout fixture");
  await page.getByLabel("Выбрать Excel или CSV").setInputFiles({
    name: "fixture.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await fixture(),
  });
  await page
    .getByRole("button", { name: "Добавить без перезаписи", exact: true })
    .click();
  for (const width of [390, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    for (const tab of ["Графики", "Портфель", "Мой бизнес"]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      await page.waitForTimeout(200);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${width} ${tab}`,
      ).toBe(true);
      await page.evaluate(() => {
        (document.activeElement as HTMLElement)?.blur();
        window.scrollTo(0, 0);
      });
      await page.screenshot({
        path: `test-results/populated-${tab}-${width}.png`,
        fullPage: true,
      });
    }
  }
  expect(errors).toEqual([]);
});
