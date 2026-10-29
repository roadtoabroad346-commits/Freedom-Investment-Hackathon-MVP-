// UI contract against mocked Auth responses; sends no real email and creates no account.
import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  await page.route("https://auth-ui-test.supabase.co/**", async (route) => {
    const url = route.request().url();
    if (route.request().method() === "OPTIONS")
      return route.fulfill({
        status: 200,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
        },
      });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(
        url.includes("/signup")
          ? {
              id: "00000000-0000-4000-a000-000000000001",
              email: "test@example.invalid",
              identities: [],
            }
          : {},
      ),
    });
  });
  await page.goto("http://127.0.0.1:3100/account");
  await page
    .getByRole("button", { name: "Создать аккаунт", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Электронная почта", { exact: true })
    .fill("test@example.invalid");
  await page.getByLabel("Пароль", { exact: true }).fill("SyntheticPassword123");
  await page.getByRole("button", { name: "Показать пароль" }).click();
  if (
    (await page.getByLabel("Пароль", { exact: true }).getAttribute("type")) !==
    "text"
  )
    throw new Error("Password reveal failed");
  await page
    .locator("form")
    .getByRole("button", { name: "Создать аккаунт" })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Подтвердите адрес" })
    .waitFor();
  await page.getByRole("button", { name: "Забыли пароль?" }).click();
  if (await page.getByLabel("Пароль", { exact: true }).count())
    throw new Error("Reset should ask email only");
  await page
    .getByRole("button", { name: "Отправить ссылку восстановления" })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Если аккаунт существует" })
    .waitFor();
  console.log(
    JSON.stringify({
      signupUi: true,
      passwordReveal: true,
      recoveryUi: true,
      realEmailSent: false,
    }),
  );
} finally {
  await browser.close();
}
