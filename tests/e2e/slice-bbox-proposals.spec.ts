import path from "node:path";

import { expect, test } from "@playwright/test";

const fixturePath = path.resolve("public/apple-touch-icon.png");

test("editor can create BBox proposals and generate reloadable slice crops", async ({ page }) => {
  const projectName = `E2E BBox ${Date.now()}`;

  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL ?? "admin@sapen.local");
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD ?? "admin1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app/);

  await page.goto("/app/projects");
  await page.getByRole("link", { name: "New project" }).first().click();
  await page.getByLabel("Name").fill(projectName);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();

  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Images" })
    .click();
  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await expect(page.getByText("apple-touch-icon.png")).toBeVisible();

  await page.getByRole("link", { name: "Crop workflow" }).click();
  await expect(
    page.getByRole("heading", { name: "Step 1: Mark slice work areas", exact: true }),
  ).toBeVisible();

  const drawingSurface = page.getByLabel("Mask drawing surface");
  await drawingSurface.scrollIntoViewIfNeeded();
  const box = await drawingSurface.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.7, { steps: 6 });
  await page.mouse.up();

  await expect(page.getByText("BBox proposal saved")).toBeVisible();
  await expect(page.getByRole("button", { name: /Slice proposal 1:/ })).toBeVisible();
  await page.getByRole("button", { name: "Confirm BBox set" }).click();
  await expect(page.getByText("BBox set confirmed")).toBeVisible();
  await page.getByRole("link", { name: "Continue to slice annotation" }).click();
  await expect(page).toHaveURL(/\/slices\/[^/]+\/crops\/[^/]+\/semantic$/);
  await expect(page.getByRole("heading", { name: /Semantic crop mask:/ })).toBeVisible();
  await expect(page.getByLabel("Slice navigator")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Slice 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lasso" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Polygon" })).toBeVisible();
  await expect(page.getByText("Support geometry derives from semantic foreground.")).toBeVisible();

  const imageMatch = page.url().match(/\/images\/([^/]+)\//);
  expect(imageMatch).not.toBeNull();
  const imageId = imageMatch?.[1];
  expect(imageId).toBeTruthy();

  await expect.poll(async () => {
    return page.evaluate(async (id) => {
      const response = await fetch(`/api/images/${id}/slice-bboxes`, { credentials: "include" });
      if (!response.ok) return 0;
      const body = await response.json();
      return body.boxes?.length ?? 0;
    }, imageId);
  }).toBe(1);

  await expect.poll(async () => {
    return page.evaluate(async (id) => {
      const response = await fetch(`/api/images/${id}/slice-crops`, { credentials: "include" });
      if (!response.ok) return 0;
      const body = await response.json();
      return body.crops?.length ?? 0;
    }, imageId);
  }).toBe(1);

  await page.reload();
  await expect(page.getByRole("heading", { name: /Semantic crop mask:/ })).toBeVisible();
  await expect(page.getByLabel("Slice navigator")).toBeVisible();
  await expect(page.getByRole("link", { name: "Support", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Editor" }).click();
  await expect(page.getByRole("button", { name: "BBox proposal" })).toBeVisible();
  await expect(page.getByAltText("Derived slice crop preview")).toBeVisible();
  await expect(page.getByText(/Crop v\d+:/)).toBeVisible();
});
