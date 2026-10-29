// Test-only configured build, mocked responses. No real user, email or recovery operation.
import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  const code = "mxr_" + "a".repeat(64);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let requests = 0;
  await page.route("**/api/handle-account", async (route) => {
    const p = route.request().postDataJSON();
    if (p.email || p.user_id)
      throw Error("Unexpected identity authority from browser");
    requests++;
    await route.fulfill({
      status: p.action === "register" ? 201 : 200,
      contentType: "application/json",
      body: JSON.stringify({
        handle: p.handle ?? "test_investor",
        recoveryCode: code,
      }),
    });
  });
  await page.goto(process.env.AUTH_UI_URL ?? "http://127.0.0.1:3101/account");
  await page.getByLabel("Логин", { exact: true }).fill("test_investor");
  await page
    .getByLabel("Пароль", { exact: true })
    .fill("SyntheticPassphrase123");
  await page
    .getByRole("button", { name: "Зарегистрироваться", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Сохраните резервный ключ" })
    .waitFor();
  if (
    await page
      .getByRole("button", { name: "Ключ сохранён — войти" })
      .isEnabled()
  )
    throw Error("Recovery acknowledgement must be explicit");
  if (
    await page.evaluate(
      (c) => Object.values(localStorage).some((v) => v.includes(c)),
      code,
    )
  )
    throw Error("Recovery code persisted unexpectedly");
  const d = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать ключ" }).click();
  if ((await d).suggestedFilename() !== "MIRROR_X_test_investor_recovery.txt")
    throw Error("Recovery download failed");
  await page
    .getByRole("checkbox", { name: "Я сохранил ключ в надёжном месте" })
    .check();
  if (
    !(await page
      .getByRole("button", { name: "Ключ сохранён — войти" })
      .isEnabled())
  )
    throw Error("Acknowledgement failed");
  await page.reload();
  await page
    .getByRole("button", { name: "Восстановить доступ", exact: true })
    .click();
  await page.getByLabel("Логин", { exact: true }).fill("test_investor");
  await page
    .getByLabel("Новый пароль", { exact: true })
    .fill("ReplacementPassphrase123");
  await page.getByLabel("Резервный ключ", { exact: true }).fill(code);
  await page
    .getByRole("button", { name: "Обновить пароль", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Сохраните резервный ключ" })
    .waitFor();
  for (const width of [390, 1366]) {
    await page.setViewportSize({ width, height: 850 });
    if (
      !(await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ))
    )
      throw Error("Mobile overflow");
  }
  if (errors.length) throw Error(errors.join(";"));
  console.log(
    JSON.stringify({
      registerPreview: true,
      explicitRecoveryAcknowledgement: true,
      recoveryDownload: true,
      noAutomaticRecoveryStorage: true,
      recoveryUi: true,
      responsive: true,
      requests,
      realAccountsCreated: false,
    }),
  );
} finally {
  await browser.close();
}
