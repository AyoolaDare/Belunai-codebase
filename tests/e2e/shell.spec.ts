import { expect, test, type Page } from "@playwright/test";

const routes = ["/", "/sign-in", "/home", "/search", "/messages", "/notifications", "/profile"];

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

for (const route of routes) {
  test(`${route} renders one h1, a main landmark and no horizontal overflow`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("main#main")).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
  });
}

test("skip link is the first tab stop and moves focus to main content", async ({ page }) => {
  await page.goto("/home");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
});

test("primary navigation is keyboard operable and marks the current page", async ({ page }) => {
  await page.goto("/home");
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");

  const messages = nav.getByRole("link", { name: "Messages" });
  await messages.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/messages$/);
  await expect(nav.getByRole("link", { name: "Messages" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current", "page");
});

test("unbuilt screens say so and offer no controls", async ({ page }) => {
  await page.goto("/messages");
  const main = page.locator("main#main");
  await expect(main.getByRole("status")).toContainText("isn't available yet");
  await expect(main.locator("button, input, textarea, select, form")).toHaveCount(0);
});

test("unknown routes show a neutral not-found page", async ({ page }) => {
  const response = await page.goto("/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page isn't available");
});

test("responses carry baseline security headers", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["x-powered-by"]).toBeUndefined();
});
