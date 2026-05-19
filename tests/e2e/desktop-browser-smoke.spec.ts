import path from "node:path";

import { expect, test } from "@playwright/test";

const fixturePath = path.resolve("tests/e2e/fixtures/wood-slice.svg");

test("desktop MVP browser workflow can upload, edit, save, and reload", async ({ page }) => {
  const projectName = `E2E Desktop ${Date.now()}`;

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

  await page.getByRole("link", { name: "Images" }).click();
  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await expect(page.getByText("wood-slice.svg")).toBeVisible();

  await page.getByRole("link", { name: "Open editor" }).click();
  await expect(page.getByRole("button", { name: "Brush" })).toBeVisible();

  const drawingSurface = page.getByLabel("Mask drawing surface");
  await expect(drawingSurface).toBeVisible();
  const box = await drawingSurface.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.up();

  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Save now" }).click();
  await expect(page.getByText("Saved")).toBeVisible();

  const match = page.url().match(/\/images\/([^/]+)\/edit/);
  expect(match).not.toBeNull();
  const imageId = match?.[1];
  expect(imageId).toBeTruthy();

  await page.reload();
  await expect(page.getByLabel("Mask drawing surface")).toBeVisible();

  await expect.poll(async () => {
    return page.evaluate(async (id) => {
      const response = await fetch(`/api/images/${id}/mask/latest`, {
        credentials: "include",
      });
      if (!response.ok) return false;
      const body = await response.json();
      return body.exists === true;
    }, imageId);
  }).toBe(true);
});
