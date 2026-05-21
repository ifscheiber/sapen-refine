import { expect, test, type APIResponse } from "@playwright/test";

const SESSION_COOKIE_NAME = "sapen_annotate_session";

async function expectJsonError(response: APIResponse, status: number, error: string) {
  expect(response.status()).toBe(status);
  expect(response.headers()["content-type"]).toContain("application/json");
  await expect(response.json()).resolves.toMatchObject({ ok: false, error });
}

test("api auth and authorization failures return stable json errors", async ({ request }) => {
  await expectJsonError(await request.get("/api/projects"), 401, "UNAUTHENTICATED");

  const login = await request.post("/api/auth/login", {
    data: { email: "labeler@sapen.local", password: "labeler1234" },
  });
  expect(login.ok()).toBe(true);
  const sessionCookie = login.headers()["set-cookie"]?.split(";")[0];
  expect(sessionCookie).toBeTruthy();
  const authHeaders = { cookie: sessionCookie! };

  await expectJsonError(
    await request.post("/api/projects/demo_project/exports", {
      data: { targets: ["combined"] },
      headers: authHeaders,
    }),
    403,
    "FORBIDDEN",
  );

  await expectJsonError(
    await request.get("/api/images/not-a-real-image/metadata", { headers: authHeaders }),
    404,
    "IMAGE_NOT_FOUND",
  );

  await expectJsonError(
    await request.get("/api/prediction-runs/not-a-real-run", { headers: authHeaders }),
    404,
    "PREDICTION_RUN_NOT_FOUND",
  );

  await expectJsonError(
    await request.post("/api/storage-cleanup", {
      data: { execute: false },
      headers: authHeaders,
    }),
    403,
    "CLEANUP_FORBIDDEN",
  );
});

test("workspace routes with stale sessions redirect to login", async ({ page }) => {
  await page.goto("/login");
  const origin = new URL(page.url()).origin;
  await page.context().addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: "stale-invalid-session",
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  const requestedPath = "/app/projects/demo_project/images/stale-session-image/edit";
  await page.goto(requestedPath);

  await expect(page).toHaveURL(/\/login\?next=/);
  const redirected = new URL(page.url());
  expect(redirected.pathname).toBe("/login");
  expect(redirected.searchParams.get("next")).toBe(requestedPath);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
