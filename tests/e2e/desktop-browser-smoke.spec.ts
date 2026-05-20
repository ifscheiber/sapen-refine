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

  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Images" })
    .click();
  await expect(page).toHaveURL(/\/images$/);
  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await expect(page.getByText("apple-touch-icon.png")).toBeVisible();
  await expect(page.getByText("T-number: missing")).toBeVisible();
  await expect(page.getByText("Missing T-number", { exact: true })).toHaveCount(0);

  await page.getByRole("link", { name: "Metadata" }).click();
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

  await page.getByRole("link", { name: "Open editor" }).click();
  await expect(page.getByRole("button", { name: "Brush" })).toBeVisible();
  expect(abortErrors()).toEqual([]);

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
