import path from "node:path";

import { expect, test } from "@playwright/test";

const fixturePath = path.resolve("public/apple-touch-icon.png");

test("desktop MVP browser workflow can upload, edit, save, and reload", async ({ page }) => {
  const projectName = `E2E Desktop ${Date.now()}`;
  const tNumber = `T-E2E-${Date.now()}`;
  const browserErrors: string[] = [];

  page.on("pageerror", (error) => {
    browserErrors.push(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  const abortErrors = () => browserErrors.filter((message) => /AbortError|operation was aborted/i.test(message));

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

  await expect(
    page.getByRole("navigation", { name: "Project navigation" }).getByRole("link", { name: "Images" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Upload image" }).click();
  const uploadDialog = page.getByRole("dialog", { name: "Upload image" });
  await uploadDialog.locator('input[type="file"]').setInputFiles(fixturePath);
  await uploadDialog.getByRole("button", { name: "Upload image" }).click();
  await expect(page.getByText("apple-touch-icon.png")).toBeVisible();
  await expect(page.getByText("T-number: missing")).toBeVisible();
  await expect(page.getByText("Missing T-number", { exact: true })).toHaveCount(0);

  await page.getByRole("link", { name: "Edit metadata" }).click();
  await expect(page.getByRole("heading", { name: "Sample Metadata" })).toBeVisible();
  await expect(page.getByText("image/png")).toBeVisible();
  await expect(page.getByText("VALIDATED")).toBeVisible();
  await expect(page.getByText(/sha256:/)).toBeVisible();
  await expect(page.getByText("180 x 180")).toBeVisible();
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

  const imageMatch = page.url().match(/\/images\/([^/?#]+)$/);
  expect(imageMatch).not.toBeNull();
  const imageId = imageMatch?.[1];
  expect(imageId).toBeTruthy();

  await expect(page.getByRole("link", { name: "Open editor" })).toHaveCount(0);
  await page.getByRole("link", { name: "Annotate image" }).click();
  await expect(page.getByRole("heading", { name: "Annotation Editor" })).toBeVisible();
  await expect(page.getByRole("link", { name: "BBoxes" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Classification" })).toHaveCount(0);
  await expect(page.getByLabel("Slice classification")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save classification" })).toHaveCount(0);
  await expect(page.getByText("0 boxes · 0 valid · 0 issues")).toBeVisible();
  expect(abortErrors()).toEqual([]);

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
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.72, { steps: 8 });
  await page.mouse.up();

  await expect(page.getByText("BBox proposal saved")).toBeVisible();
  await expect(page.getByLabel("Select BBox")).toHaveCount(0);
  await expect(page.getByText("Selected BBox active on canvas.")).toBeVisible();
  await page.getByRole("button", { name: "Prepare slices" }).click();
  await expect(page.getByText("BBox set confirmed")).toBeVisible();
  await page.getByRole("link", { name: "Open slice annotation" }).click();
  await expect(page).toHaveURL(/\/crop\/slices\/[^/]+\/crops\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "Annotation Editor" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Classification" })).toHaveCount(0);
  await expect(page.getByLabel("Slice classification")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save classification" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sapwood / Heartwood" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cu", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open editor" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Full editor" })).toHaveCount(0);

  await expect(page.getByText("Support geometry derives from semantic foreground.")).toBeVisible();

  const semanticSurface = page.getByLabel("Mask drawing surface");
  await expect(semanticSurface).toBeVisible();
  await semanticSurface.scrollIntoViewIfNeeded();
  const semanticBox = await semanticSurface.boundingBox();
  expect(semanticBox).not.toBeNull();
  if (!semanticBox) return;

  await page.getByRole("button", { name: "Brush", exact: true }).click();
  await page.mouse.move(semanticBox.x + semanticBox.width * 0.35, semanticBox.y + semanticBox.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(semanticBox.x + semanticBox.width * 0.65, semanticBox.y + semanticBox.height * 0.55, { steps: 8 });
  await page.mouse.up();

  await page.getByRole("button", { name: "Background" }).click();
  await expect(page.getByRole("button", { name: "Background" })).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(semanticBox.x + semanticBox.width * 0.45, semanticBox.y + semanticBox.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(semanticBox.x + semanticBox.width * 0.5, semanticBox.y + semanticBox.height * 0.5, { steps: 4 });
  await page.mouse.up();

  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Commit Sap/Heartwood semantic mask" }).click();
  await expect(page.getByText(/Saved; suggested Sap\/Heartwood slice|Saved/)).toBeVisible();
  await expect(page.getByText(/Classification: Sap\/Heartwood slice/)).toBeVisible();

  const semanticRows = page.locator("[data-review-target='semantic-SAP_HEARTWOOD']");
  const classificationRows = page.locator("[data-review-target='classification']");
  const semanticReview = semanticRows.filter({ hasText: /Sap\/Heartwood: Draft v\d+/ }).first();
  await expect(semanticReview).toBeVisible();
  await semanticReview.getByRole("button", { name: "Submit" }).click();
  const submittedSemanticReview = semanticRows.filter({ hasText: /Sap\/Heartwood: Submitted v\d+/ }).first();
  await expect(submittedSemanticReview).toBeVisible();
  await submittedSemanticReview.getByRole("button", { name: "Approve" }).click();
  await expect(semanticRows.filter({ hasText: /Sap\/Heartwood: Approved v\d+/ }).first()).toBeVisible();

  const classificationReview = classificationRows.filter({ hasText: /Classification: Draft v\d+/ }).first();
  await expect(classificationReview).toBeVisible();
  await classificationReview.getByRole("button", { name: "Submit" }).click();
  const submittedClassificationReview = classificationRows.filter({ hasText: /Classification: Submitted v\d+/ }).first();
  await expect(submittedClassificationReview).toBeVisible();
  await submittedClassificationReview.getByRole("button", { name: "Approve" }).click();
  await expect(classificationRows.filter({ hasText: /Classification: Approved v\d+/ }).first()).toBeVisible();
  await expect(page.getByText("Export readiness: ready")).toBeVisible();

  await expect.poll(async () => {
    return page.evaluate(async (id) => {
      const response = await fetch(`/api/images/${id}/slice-crops`, {
        credentials: "include",
      });
      if (!response.ok) return false;
      const body = await response.json();
      return (body.crops?.length ?? 0) > 0;
    }, imageId);
  }).toBe(true);

  await expect.poll(async () => {
    return page.evaluate(async ({ projectId, imageId }) => {
      const response = await fetch(`/api/projects/${projectId}/crop-readiness?imageId=${imageId}`, {
        credentials: "include",
      });
      if (!response.ok) return false;
      const body = await response.json();
      return body.summary?.readyCropItems === 1;
    }, { projectId: projectId!, imageId: imageId! });
  }).toBe(true);

  await page.goto(`/app/projects/${projectId}`);
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Project status" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Primary actions" })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Exports" })
    .click();
  await expect(page).toHaveURL(/\/exports$/);
  await expect(page.getByRole("heading", { name: "Project exports" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Training export" })).toBeVisible();
  await expect(page.getByText("Semantic approved")).toBeVisible();
  await expect(page.getByText("Classifications approved")).toBeVisible();
  await expect(page.getByText("Crop ready")).toBeVisible();
  await page.getByLabel("Crop training").check();
  await expect(page.getByRole("button", { name: "Create export" })).toBeEnabled();
  await page.getByRole("button", { name: "Create export" }).click();
  await expect(page.getByText(/Export (PENDING|PROCESSING|COMPLETED)/)).toBeVisible();
  await page.evaluate(async () => {
    const response = await fetch("/api/export-jobs/process-due", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ maxJobs: 5 }),
      credentials: "include",
    });
    if (!response.ok) throw new Error(`EXPORT_JOB_PROCESS_FAILED_${response.status}`);
  });
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

  await page.goto(`/app/projects/${projectId}/prediction-imports`);
  await expect(page.getByRole("heading", { name: "Prediction imports" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prediction batch imports" })).toBeVisible();

  const correctionTaskId = await page.evaluate(
    async ({ projectId, imageId }) => {
      async function jsonRequest(path: string, init: RequestInit) {
        const response = await fetch(path, {
          ...init,
          credentials: "include",
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.ok) {
          throw new Error(`${path} failed ${response.status}: ${JSON.stringify(body)}`);
        }
        return body;
      }

      const unique = Date.now();
      const model = await jsonRequest("/api/model-runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          modelFamily: `e2e-assisted-${unique}`,
          modelName: "desktop-assisted",
          modelVersion: "0.1.0",
          taskType: "SEMANTIC_SEGMENTATION",
          checkpointHash: `sha256:e2e-checkpoint-${unique}`,
          configHash: `sha256:e2e-config-${unique}`,
        }),
      });

      const predictionRun = await jsonRequest(`/api/projects/${projectId}/prediction-runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          modelRunId: model.modelRun.id,
          inferenceRunId: `e2e-assisted-${unique}`,
          status: "COMPLETED",
          inputImageCount: 1,
          outputPredictionCount: 1,
        }),
      });

      const bytes = new Uint8Array(180 * 180);
      bytes.fill(1);
      const form = new FormData();
      form.append("imageId", imageId);
      form.append("targetType", "SEMANTIC_MASK");
      form.append("width", "180");
      form.append("height", "180");
      form.append("file", new File([bytes], "prediction.u8raw", { type: "application/octet-stream" }));

      await jsonRequest(`/api/prediction-runs/${predictionRun.predictionRun.id}/predictions`, {
        method: "POST",
        body: form,
      });

      const tasks = await jsonRequest(`/api/prediction-runs/${predictionRun.predictionRun.id}/correction-tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      return tasks.tasks[0].id as string;
    },
    { projectId: projectId!, imageId: imageId! },
  );

  await page.goto(`/app/projects/${projectId}/tasks`);
  await expect(page.getByText("Queue")).toBeVisible();
  await page.getByRole("link", { name: "Open correction" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/tasks/${correctionTaskId}/correct`));
  await expect(page.getByText("Prediction / model proposal")).toBeVisible();
  await expect(page.getByRole("button", { name: "Use prediction as starting mask" })).toBeEnabled();
  await page.getByRole("button", { name: "Use prediction as starting mask" }).click();
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Save correction draft" }).click();
  await expect(page.getByText("Correction draft saved")).toBeVisible();

  await expect.poll(async () => {
    return page.evaluate(async ({ id, taskId }) => {
      const [reviewState, task] = await Promise.all([
        fetch(`/api/images/${id}/review-state`, { credentials: "include" }).then((response) => response.json()),
        fetch(`/api/correction-tasks/${taskId}`, { credentials: "include" }).then((response) => response.json()),
      ]);
      return {
        semanticState: reviewState.reviewables?.semanticMask?.latestVersion?.reviewState ?? null,
        taskStatus: task.task?.status ?? null,
      };
    }, { id: imageId, taskId: correctionTaskId });
  }).toEqual({ semanticState: "DRAFT", taskStatus: "IN_PROGRESS" });

  expect(abortErrors()).toEqual([]);
});
