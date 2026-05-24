import { expect, test } from "@playwright/test";

test.use({
  viewport: { width: 820, height: 1180 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});

test("ipad preparation viewport opens login and exposes app manifest", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Workspace Access" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest"
  );

  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  const body = await manifest.json();
  expect(body.name).toBe("SaPen Annotate");
  expect(body.display).toBe("standalone");
});
