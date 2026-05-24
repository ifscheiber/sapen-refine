import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const fixturePath = path.resolve("public/apple-touch-icon.png");

type WorkbenchIds = {
  projectId: string;
  imageId: string;
  sliceInstanceId: string;
  cropId: string;
};

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL ?? "admin@sapen.local");
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD ?? "admin1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app/);
}

async function createProject(page: Page, name: string) {
  await page.goto("/app/projects");
  await page.getByRole("link", { name: "New project" }).first().click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  const projectId = page.url().match(/\/app\/projects\/([^/?#]+)/)?.[1];
  expect(projectId).toBeTruthy();
  return projectId!;
}

async function drawRelativeStroke(page: Page, fromX: number, fromY: number, toX: number, toY: number) {
  const drawingSurface = page.getByLabel("Mask drawing surface");
  await expect(drawingSurface).toBeVisible();
  await expect
    .poll(async () =>
      drawingSurface.evaluate((node) => {
        const canvas = node as HTMLCanvasElement;
        return canvas.width > 0 && canvas.height > 0;
      }),
    )
    .toBe(true);
  await drawingSurface.scrollIntoViewIfNeeded();
  const box = await drawingSurface.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error("MASK_DRAWING_SURFACE_MISSING");

  await page.mouse.move(box.x + box.width * fromX, box.y + box.height * fromY);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * toX, box.y + box.height * toY, { steps: 8 });
  await page.mouse.up();
}

async function fillRelativePolygon(page: Page, points: Array<[number, number]>) {
  const drawingSurface = page.getByLabel("Mask drawing surface");
  await expect(drawingSurface).toBeVisible();
  await drawingSurface.scrollIntoViewIfNeeded();
  const box = await drawingSurface.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error("MASK_DRAWING_SURFACE_MISSING");

  await page.getByRole("button", { name: "Polygon" }).click();
  for (const [x, y] of points) {
    await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
  }
  await page.getByRole("button", { name: "Commit" }).click();
}

function parseWorkbenchIds(url: string): WorkbenchIds {
  const match = url.match(/\/app\/projects\/([^/]+)\/images\/([^/]+)\/crop\/slices\/([^/]+)\/crops\/([^/?#]+)/);
  if (!match) throw new Error(`UNEXPECTED_WORKBENCH_URL: ${url}`);
  return {
    projectId: match[1],
    imageId: match[2],
    sliceInstanceId: match[3],
    cropId: match[4],
  };
}

async function createSingleCropWorkbench(page: Page, projectName: string) {
  await login(page);
  await createProject(page, projectName);

  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Images" })
    .click();
  await expect(page).toHaveURL(/\/images$/);
  await expect(page.getByText("Upload image", { exact: true })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await expect(page.getByText("apple-touch-icon.png")).toBeVisible();

  await expect(page.getByRole("link", { name: "Open editor" })).toHaveCount(0);
  await page.getByRole("link", { name: "Crop workflow" }).click();
  await expect(page).toHaveURL(/\/crop\/bboxes$/);
  await expect(
    page.getByRole("heading", { name: "Step 1: Mark slice work areas", exact: true }),
  ).toBeVisible();

  await drawRelativeStroke(page, 0.25, 0.25, 0.75, 0.72);
  await expect(page.getByText("BBox proposal saved")).toBeVisible();
  await page.getByRole("button", { name: "Confirm BBox set" }).click();
  await expect(page.getByText("BBox set confirmed")).toBeVisible();
  await page.getByRole("link", { name: "Continue to slice annotation" }).click();
  await expect(page).toHaveURL(/\/crop\/slices\/[^/]+\/crops\/[^/]+$/);
  await expect(page.getByRole("heading", { name: /Crop workbench:/ })).toBeVisible();

  return parseWorkbenchIds(page.url());
}

async function readCropReadiness(page: Page, ids: Pick<WorkbenchIds, "projectId" | "imageId">) {
  return page.evaluate(async ({ projectId, imageId }) => {
    const response = await fetch(`/api/projects/${projectId}/crop-readiness?imageId=${imageId}`, {
      cache: "no-store",
      credentials: "include",
    });
    const body = await response.json();
    if (!response.ok || !body?.ok) {
      throw new Error(`CROP_READINESS_FAILED_${response.status}: ${JSON.stringify(body)}`);
    }
    const candidate = body.candidates?.[0] ?? null;
    return {
      summary: body.summary,
      candidate: candidate
        ? {
            readinessStatus: candidate.readinessStatus,
            readinessReasons: candidate.readinessReasons,
            supportGeometrySource: candidate.supportGeometrySource,
            latestSupportState: candidate.latestSupportMask?.reviewState ?? null,
            latestSemanticState: candidate.latestSemanticMask?.reviewState ?? null,
            latestClassificationState: candidate.latestClassification?.reviewState ?? null,
          }
        : null,
    };
  }, ids);
}

async function submitAndApproveSupport(page: Page) {
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText(/submitted support v\d+/i)).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText(/approved support v\d+/i)).toBeVisible();
}

async function submitAndApproveSemanticAndClassification(page: Page, semanticLabel: string) {
  const reviewRows = page.locator("div.flex.min-h-11.items-center.gap-1");

  const semanticDraft = reviewRows.filter({ hasText: new RegExp(`${semanticLabel}: Draft v\\d+`) }).first();
  await expect(semanticDraft).toBeVisible();
  await semanticDraft.getByRole("button", { name: "Submit" }).click();
  const semanticSubmitted = reviewRows.filter({ hasText: new RegExp(`${semanticLabel}: Submitted v\\d+`) }).first();
  await expect(semanticSubmitted).toBeVisible();
  await semanticSubmitted.getByRole("button", { name: "Approve" }).click();
  await expect(reviewRows.filter({ hasText: new RegExp(`${semanticLabel}: Approved v\\d+`) }).first()).toBeVisible();

  const classificationDraft = reviewRows.filter({ hasText: /Classification: Draft v\d+/ }).first();
  await expect(classificationDraft).toBeVisible();
  await classificationDraft.getByRole("button", { name: "Submit" }).click();
  const classificationSubmitted = reviewRows.filter({ hasText: /Classification: Submitted v\d+/ }).first();
  await expect(classificationSubmitted).toBeVisible();
  await classificationSubmitted.getByRole("button", { name: "Approve" }).click();
  await expect(reviewRows.filter({ hasText: /Classification: Approved v\d+/ }).first()).toBeVisible();
}

test("Copper crop drafts save before support but require approved support for readiness", async ({ page }) => {
  const ids = await createSingleCropWorkbench(page, `E2E RB-098 Copper ${Date.now()}`);

  await page.getByRole("link", { name: "Draw Copper draft" }).click();
  await expect(page).toHaveURL(/\/semantic\?mode=COPPER$/);
  await expect(page.getByRole("heading", { name: /Semantic crop mask:/ })).toBeVisible();
  await expect(page.getByText("Copper drafts can save now; support is required before export.")).toBeVisible();

  await drawRelativeStroke(page, 0.45, 0.45, 0.55, 0.55);
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Save semantic mask" }).click();
  await expect(page.getByText(/Saved; suggested Copper slice|Saved/)).toBeVisible();
  await expect(page.getByText(/Classification: Copper slice/)).toBeVisible();
  await expect(page.getByText("Export readiness: partial")).toBeVisible();

  await expect
    .poll(async () => readCropReadiness(page, ids))
    .toMatchObject({
      summary: {
        readyCropItems: 0,
        partialCropItems: 1,
        cropReasonCounts: {
          MISSING_SUPPORT_MASK: 1,
        },
      },
      candidate: {
        readinessStatus: "PARTIAL",
        readinessReasons: expect.arrayContaining(["MISSING_SUPPORT_MASK"]),
        supportGeometrySource: "EXPLICIT_SUPPORT_MASK",
        latestSemanticState: "DRAFT",
        latestClassificationState: "DRAFT",
      },
    });

  await page.getByRole("link", { name: "Support", exact: true }).click();
  await expect(page).toHaveURL(/\/support$/);
  await expect(page.getByRole("heading", { name: /Support mask:/ })).toBeVisible();
  await fillRelativePolygon(page, [
    [0.2, 0.2],
    [0.8, 0.2],
    [0.8, 0.8],
    [0.2, 0.8],
  ]);
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Save support mask" }).click();
  await expect(page.getByText(/draft support v\d+/i)).toBeVisible();
  await submitAndApproveSupport(page);

  await page.goto(
    `/app/projects/${ids.projectId}/images/${ids.imageId}/crop/slices/${ids.sliceInstanceId}/crops/${ids.cropId}/semantic?mode=COPPER`,
  );
  await expect(page).toHaveURL(/\/semantic\?mode=COPPER$/);
  await expect(page.getByRole("heading", { name: /Semantic crop mask:/ })).toBeVisible();
  await expect(page.getByText("Outside-support pixels are locked.")).toBeVisible();
  await drawRelativeStroke(page, 0.47, 0.47, 0.53, 0.53);
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Save semantic mask" }).click();
  await expect(page.getByText(/Classification: Copper slice/)).toBeVisible();
  await submitAndApproveSemanticAndClassification(page, "Copper");
  await expect(page.getByText("Export readiness: ready")).toBeVisible();

  await expect.poll(async () => readCropReadiness(page, ids)).toMatchObject({
    summary: {
      readyCropItems: 1,
      partialCropItems: 0,
      cropItemsWithWarnings: 0,
    },
    candidate: {
      readinessStatus: "READY",
      readinessReasons: [],
      supportGeometrySource: "EXPLICIT_SUPPORT_MASK",
      latestSupportState: "APPROVED",
      latestSemanticState: "APPROVED",
      latestClassificationState: "APPROVED",
    },
  });
});

test("semantic family switch requires explicit reset confirmation", async ({ page }) => {
  await createSingleCropWorkbench(page, `E2E RB-098 Family ${Date.now()}`);

  await page.getByRole("link", { name: "Start Sap/Heartwood semantic" }).click();
  await expect(page).toHaveURL(/\/semantic\?mode=SAP_HEARTWOOD$/);
  await expect(page.getByRole("heading", { name: /Semantic crop mask:/ })).toBeVisible();
  await expect(page.getByText("Support geometry derives from semantic foreground.")).toBeVisible();

  await drawRelativeStroke(page, 0.45, 0.45, 0.55, 0.55);
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Save semantic mask" }).click();
  await expect(page.getByText(/Saved; suggested Sap\/Heartwood slice|Saved/)).toBeVisible();
  await expect(page.getByText(/Classification: Sap\/Heartwood slice/)).toBeVisible();

  const dialogPromise = page.waitForEvent("dialog").then(async (dialog) => {
    expect(dialog.message()).toContain("Reset semantic family to Copper");
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: "Copper", exact: true }).click();
  await dialogPromise;

  await expect(page.getByRole("button", { name: "Sap/Heartwood" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Copper", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("Support geometry derives from semantic foreground.")).toBeVisible();
});
