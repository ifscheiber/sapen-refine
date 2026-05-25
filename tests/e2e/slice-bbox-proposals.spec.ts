import fs from "node:fs";
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

  const fixtureBuffer = fs.readFileSync(fixturePath);
  await expect(page.getByText("Upload image", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Upload image" }).click();
  let uploadDialog = page.getByRole("dialog", { name: "Upload image" });
  await uploadDialog.locator('input[type="file"]').setInputFiles({
    name: "editor-primary.png",
    mimeType: "image/png",
    buffer: fixtureBuffer,
  });
  await uploadDialog.getByRole("button", { name: "Upload image" }).click();
  await expect(page.getByText("editor-primary.png")).toBeVisible();
  await page.getByRole("button", { name: "Upload image" }).click();
  uploadDialog = page.getByRole("dialog", { name: "Upload image" });
  await uploadDialog.locator('input[type="file"]').setInputFiles({
    name: "editor-secondary.png",
    mimeType: "image/png",
    buffer: fixtureBuffer,
  });
  await uploadDialog.getByRole("button", { name: "Upload image" }).click();
  await expect(page.getByText("editor-secondary.png")).toBeVisible();

  await page.getByRole("link", { name: "Annotate image" }).first().click();
  await expect(page.getByRole("heading", { name: "Annotation Editor" })).toBeVisible();
  const breadcrumbs = page.getByRole("navigation", { name: "Breadcrumbs" });
  await expect(breadcrumbs.getByText(projectName)).toBeVisible();
  await expect(breadcrumbs.getByText("editor-secondary.png")).toBeVisible();
  const shellSidebar = page.locator("aside").first();
  await expect(shellSidebar.getByRole("heading", { name: "Image Summary" })).toBeVisible();
  await expect(shellSidebar.getByRole("heading", { name: "Projects Summary" })).toHaveCount(0);
  await expect(shellSidebar.getByRole("link", { name: "Back to Project Images" })).toBeVisible();
  await expect(shellSidebar.getByRole("link", { name: "New Project" })).toHaveCount(0);
  await expect(shellSidebar.getByRole("link", { name: "Upload Images" })).toHaveCount(0);
  await expect(shellSidebar.getByRole("link", { name: "Project Gallery" })).toHaveCount(0);
  await expect(shellSidebar.getByRole("heading", { name: "Images" })).toBeVisible();
  await expect(shellSidebar.getByRole("link", { name: /editor-secondary\.png/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await shellSidebar.getByRole("link", { name: /editor-primary\.png/ }).click();
  await expect(page).toHaveURL(/\/crop\/bboxes$/);
  await expect(breadcrumbs.getByText("editor-primary.png")).toBeVisible();
  await expect(shellSidebar.getByRole("link", { name: /editor-primary\.png/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("link", { name: "BBoxes" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "BBox status" })).toBeVisible();
  await expect(page.getByText("0 valid · 0 issues")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add BBox" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete selected BBox" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Resize" })).toHaveCount(0);

  const drawingSurface = page.getByLabel("Mask drawing surface");
  await expect(drawingSurface).toBeVisible();
  await expect
    .poll(async () =>
      drawingSurface.evaluate((node) => {
        const canvas = node as HTMLCanvasElement;
        return { height: canvas.height, width: canvas.width };
      }),
    )
    .toEqual({ height: 180, width: 180 });
  await drawingSurface.scrollIntoViewIfNeeded();
  const box = await drawingSurface.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.7, { steps: 6 });
  await page.mouse.up();

  await expect(page.getByLabel("BBox tools").getByText("BBox proposal saved")).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete selected BBox" })).toBeEnabled();
  await page.mouse.click(box.x + box.width * 0.08, box.y + box.height * 0.08);
  await expect(page.getByRole("button", { name: "Delete selected BBox" })).toBeDisabled();
  await expect(page.getByLabel("Select BBox")).toHaveCount(0);
  await page.getByRole("link", { name: "Semantic Masks" }).click();
  await expect(page).toHaveURL(/\/crop\/slices\/[^/]+\/crops\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "Annotation Editor" })).toBeVisible();
  const sliceNavigator = page.getByRole("complementary", { name: "Slice navigator" });
  await expect(sliceNavigator).toBeVisible();
  await expect(page.getByRole("button", { name: "Sapwood / Heartwood" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cu", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Slice 1" })).toBeVisible();
  await expect(sliceNavigator.getByText(/^1$/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Lasso", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Polygon", exact: true })).toBeVisible();
  await expect(page.getByText("Support geometry derives from semantic foreground.")).toBeVisible();
  await expect(page.getByRole("link", { name: "BBoxes" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit BBoxes" })).toHaveCount(0);
  await expect(sliceNavigator.getByRole("button", { name: /#1\s+Slice 1/ })).toHaveCount(0);
  await expect(sliceNavigator.getByRole("button", { name: "Refresh navigator" })).toHaveCount(0);
  await expect(sliceNavigator.getByRole("link", { name: "Editor" })).toHaveCount(0);
  await expect(sliceNavigator.getByRole("link", { name: "Full editor" })).toHaveCount(0);

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
  await expect(page.getByRole("heading", { name: "Annotation Editor" })).toBeVisible();
  await expect(sliceNavigator).toBeVisible();
  await expect(page.getByRole("button", { name: "Cu", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "BBoxes" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit BBoxes" })).toHaveCount(0);
  await expect(sliceNavigator.getByRole("link", { name: "Editor" })).toHaveCount(0);
  await expect(sliceNavigator.getByRole("link", { name: "Full editor" })).toHaveCount(0);

  await page.getByRole("link", { name: "BBoxes" }).click();
  await expect(page).toHaveURL(/\/crop\/bboxes$/);
  await expect(page.getByRole("heading", { name: "Annotation Editor" })).toBeVisible();
  await expect(page.getByRole("link", { name: "BBoxes" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("1 valid · 0 issues")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Step 1: Mark slice work areas", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Full editor" })).toHaveCount(0);
  await expect(page.getByText("Prepared")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add BBox" })).toBeDisabled();
  await page.getByRole("button", { name: "Unlock BBox editing" }).click();
  await expect(page.getByLabel("BBox tools").getByText("BBox editing unlocked")).toBeVisible();

  const replacementSurface = page.getByLabel("Mask drawing surface");
  await replacementSurface.scrollIntoViewIfNeeded();
  const replacementBox = await replacementSurface.boundingBox();
  expect(replacementBox).not.toBeNull();
  if (!replacementBox) return;

  await page.mouse.move(
    replacementBox.x + replacementBox.width * 0.45,
    replacementBox.y + replacementBox.height * 0.45,
  );
  await page.mouse.down();
  await page.mouse.move(
    replacementBox.x + replacementBox.width * 0.5,
    replacementBox.y + replacementBox.height * 0.5,
    { steps: 6 },
  );
  await page.mouse.up();

  await expect(page.getByLabel("BBox tools").getByText("BBox proposal replaced")).toBeVisible();
  await expect(page.getByText("Needs regeneration")).toBeVisible();
  await page.getByRole("link", { name: "Semantic Masks" }).click();
  await expect(page).toHaveURL(/\/crop\/slices\/[^/]+\/crops\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "Annotation Editor" })).toBeVisible();
});
