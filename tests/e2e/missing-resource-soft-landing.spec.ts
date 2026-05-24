import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const fixturePath = path.resolve("public/apple-touch-icon.png");

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

async function uploadFixtureAndGetImageId(page: Page, projectId: string) {
  await page.goto(`/app/projects/${projectId}`);
  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await expect(page.getByText("apple-touch-icon.png")).toBeVisible();
  const metadataHref = await page.getByRole("link", { name: "Metadata" }).getAttribute("href");
  const imageId = metadataHref?.match(/\/images\/([^/]+)$/)?.[1];
  expect(imageId).toBeTruthy();
  return imageId!;
}

test("removed legacy image editor URLs render workspace not-found UX", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  await login(page);
  await page.goto("/app/projects/demo_project/images/stale-image-id/edit");

  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByText("This workspace page is not available")).toBeVisible();
  expect(browserErrors.filter((message) => /IMAGE_NOT_FOUND|PROJECT_NOT_FOUND|TASK_NOT_FOUND/.test(message))).toEqual([]);
});

test("unknown workspace routes render SaPen Annotate not-found UX", async ({ page }) => {
  await login(page);
  await page.goto("/app/not-a-real-workspace-route");

  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByText("This workspace page is not available")).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Projects" })).toHaveAttribute(
    "href",
    "/app/projects",
  );
});

test("removed project images route redirects to project overview", async ({ page }) => {
  await login(page);
  const projectId = await createProject(page, `RB-122 Redirect ${Date.now()}`);

  await page.goto(`/app/projects/${projectId}/images`);

  await expect(page).toHaveURL(new RegExp(`/app/projects/${projectId}$`));
  await expect(page.getByText("Upload image", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Project navigation" }).getByRole("link", { name: "Images" }),
  ).toHaveCount(0);
});

test("project/image mismatches soft land without breaking valid metadata links", async ({ page }) => {
  await login(page);

  const projectA = await createProject(page, `RB-082 A ${Date.now()}`);
  const imageId = await uploadFixtureAndGetImageId(page, projectA);

  const projectB = await createProject(page, `RB-082 B ${Date.now()}`);
  await page.goto(`/app/projects/${projectB}/images/${imageId}`);

  await expect(page.getByRole("heading", { name: "Image not found" })).toBeVisible();
  await expect(page.getByText("Image not found or no longer available")).toBeVisible();
  await expect(page.getByRole("link", { name: "Project overview" })).toHaveAttribute(
    "href",
    `/app/projects/${projectB}`,
  );
});
