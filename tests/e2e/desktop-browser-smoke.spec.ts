import path from "node:path";

import { expect, test } from "@playwright/test";

const fixturePath = path.resolve("tests/e2e/fixtures/wood-slice.svg");

test("desktop MVP browser workflow can upload, edit, save, and reload", async ({ page }) => {
  const projectName = `E2E Desktop ${Date.now()}`;
  const tNumber = `T-E2E-${Date.now()}`;

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
  const projectMatch = page.url().match(/\/app\/projects\/([^/?#]+)/);
  expect(projectMatch).not.toBeNull();
  const projectId = projectMatch?.[1];
  expect(projectId).toBeTruthy();

  await page.getByRole("link", { name: "Images" }).click();
  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await expect(page.getByText("wood-slice.svg")).toBeVisible();

  await page.getByRole("link", { name: "Metadata" }).click();
  await expect(page.getByRole("heading", { name: "Sample Metadata" })).toBeVisible();
  await page.getByLabel("T-number").fill(tNumber);
  await page.getByLabel("Specimen identifier").fill("Desktop browser specimen");
  await page.getByLabel("Slice index").fill("1");
  await page.getByLabel("Camera/device").fill("Desktop browser camera");
  await page.getByLabel("Lighting setup").fill("E2E light box");
  await page.getByRole("button", { name: "Save metadata" }).click();
  await expect(page.getByText("Metadata saved")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("T-number")).toHaveValue(tNumber);
  await expect(page.getByLabel("Camera/device")).toHaveValue("Desktop browser camera");

  await page.getByRole("link", { name: "Open editor" }).click();
  await expect(page.getByRole("button", { name: "Brush" })).toBeVisible();

  const drawingSurface = page.getByLabel("Mask drawing surface");
  await expect(drawingSurface).toBeVisible();
  await drawingSurface.scrollIntoViewIfNeeded();
  const box = await drawingSurface.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.up();

  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Save now" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  const match = page.url().match(/\/images\/([^/]+)\/edit/);
  expect(match).not.toBeNull();
  const imageId = match?.[1];
  expect(imageId).toBeTruthy();

  await page.getByRole("button", { name: "Slice support" }).first().click();
  await expect(page.getByRole("button", { name: "Slice support" }).first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await drawingSurface.scrollIntoViewIfNeeded();
  const supportBox = await drawingSurface.boundingBox();
  expect(supportBox).not.toBeNull();
  if (!supportBox) return;

  await page.mouse.move(supportBox.x + supportBox.width * 0.3, supportBox.y + supportBox.height * 0.35);
  await page.mouse.down();
  await page.mouse.move(supportBox.x + supportBox.width * 0.7, supportBox.y + supportBox.height * 0.65, { steps: 8 });
  await page.mouse.up();

  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Save support mask" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  await page.getByRole("combobox", { name: "Slice classification" }).selectOption("COPPER_SLICE");
  await page.getByRole("button", { name: "Save classification" }).click();
  await expect(page.getByText("Classification saved")).toBeVisible();

  await expect(page.getByRole("button", { name: "Submit Semantic mask" })).toBeEnabled();
  await page.getByRole("button", { name: "Submit Semantic mask" }).click();
  await expect(page.getByText("Semantic mask Submitted")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve Semantic mask" })).toBeEnabled();
  await page.getByRole("button", { name: "Approve Semantic mask" }).click();
  await expect(page.getByText("Semantic mask Approved")).toBeVisible();

  await expect(page.getByRole("button", { name: "Submit Slice support mask" })).toBeEnabled();
  await page.getByRole("button", { name: "Submit Slice support mask" }).click();
  await expect(page.getByText("Slice support mask Submitted")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve Slice support mask" })).toBeEnabled();
  await page.getByRole("button", { name: "Approve Slice support mask" }).click();
  await expect(page.getByText("Slice support mask Approved")).toBeVisible();

  await expect(page.getByRole("button", { name: "Submit Slice classification" })).toBeEnabled();
  await page.getByRole("button", { name: "Submit Slice classification" }).click();
  await expect(page.getByText("Slice classification Submitted")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve Slice classification" })).toBeEnabled();
  await page.getByRole("button", { name: "Approve Slice classification" }).click();
  await expect(page.getByText("Slice classification Approved")).toBeVisible();
  await expect(page.getByText("Export-ready: Yes")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Mask drawing surface")).toBeVisible();
  await expect(page.getByText(/Support mask: Approved v\d+ saved/)).toBeVisible();
  await expect(page.getByText("Classification: Copper slice")).toBeVisible();
  await expect(page.getByText("Export-ready: Yes")).toBeVisible();

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

  await expect.poll(async () => {
    return page.evaluate(async (id) => {
      const support = await fetch(`/api/images/${id}/support-mask/latest`, {
        credentials: "include",
      });
      if (!support.ok) return false;
      const body = await support.json();
      return body.exists === true;
    }, imageId);
  }).toBe(true);

  await expect.poll(async () => {
    return page.evaluate(async (id) => {
      const slice = await fetch(`/api/images/${id}/slice`, {
        credentials: "include",
      });
      if (!slice.ok) return null;
      const body = await slice.json();
      return body.latestClassification?.class ?? null;
    }, imageId);
  }).toBe("COPPER_SLICE");

  await expect.poll(async () => {
    return page.evaluate(async (id) => {
      const response = await fetch(`/api/images/${id}/review-state`, {
        credentials: "include",
      });
      if (!response.ok) return false;
      const body = await response.json();
      return (
        body.exportReady === true &&
        Boolean(body.reviewables?.semanticMask?.latestApprovedVersion?.id) &&
        Boolean(body.reviewables?.supportMask?.latestApprovedVersion?.id) &&
        Boolean(body.reviewables?.sliceClassification?.latestApprovedVersion?.id)
      );
    }, imageId);
  }).toBe(true);

  await page.goto(`/app/projects/${projectId}`);
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Training export" })).toBeVisible();
  await expect(page.getByText("Semantic approved")).toBeVisible();
  await expect(page.getByText("Support approved")).toBeVisible();
  await expect(page.getByText("Classifications approved")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create export" })).toBeEnabled();
  await page.getByRole("button", { name: "Create export" }).click();
  await expect(page.getByText("Export COMPLETED")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Download manifest" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download package" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download manifest" })).toHaveAttribute(
    "href",
    /\/api\/exports\/[^/]+\/download\?file=manifest/,
  );
  await expect(page.getByRole("link", { name: "Download package" })).toHaveAttribute(
    "href",
    /\/api\/exports\/[^/]+\/download\?file=package/,
  );
});
