import path from "node:path";

import { expect, test } from "@playwright/test";

const fixturePath = path.resolve("public/apple-touch-icon.png");

test("annotator workspace hides operational surfaces while keeping image annotation entrypoints", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_ANNOTATOR_EMAIL ?? "labeler@sapen.local");
  await page.getByLabel("Password").fill(process.env.E2E_ANNOTATOR_PASSWORD ?? "labeler1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app/);

  await page.goto("/app/projects/demo_project");

  await expect(page.getByRole("link", { name: "New Project" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Project Settings" })).toHaveCount(0);

  const projectNavigation = page.getByRole("navigation", { name: "Project navigation" });
  await expect(projectNavigation.getByRole("link", { name: "Images" })).toBeVisible();
  await expect(projectNavigation.getByRole("link", { name: "Exports" })).toHaveCount(0);
  await expect(projectNavigation.getByRole("link", { name: "Tasks" })).toHaveCount(0);
  await expect(projectNavigation.getByRole("link", { name: "Prediction Imports" })).toHaveCount(0);

  await expect(page.getByRole("heading", { name: "Project status" })).toBeVisible();
  await expect(page.getByText("Prediction imports")).toHaveCount(0);
  await expect(page.getByText("Prediction runs")).toHaveCount(0);
  await expect(page.getByText("Exports")).toHaveCount(0);

  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await expect(page.getByText("apple-touch-icon.png").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Metadata" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Crop workflow" }).first()).toBeVisible();

  await page.getByRole("link", { name: "Crop workflow" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Step 1: Mark slice work areas", exact: true }),
  ).toBeVisible();
});
