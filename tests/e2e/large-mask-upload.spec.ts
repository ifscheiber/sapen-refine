import { deflateSync } from "node:zlib";

import { expect, test } from "@playwright/test";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data = Buffer.alloc(0)) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.byteLength, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function grayscalePng(width: number, height: number) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // grayscale
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filters
  ihdr[12] = 0; // no interlace

  const rawScanlines = Buffer.alloc((width + 1) * height);
  const idat = deflateSync(rawScanlines, { level: 9 });
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND"),
  ]);
}

test("large full-resolution editor mask upload sends exact raw byte length", async ({ page }) => {
  test.setTimeout(90_000);

  const width = 6000;
  const height = 4000;
  const expectedBytes = width * height;
  const projectName = `E2E Large Mask ${Date.now()}`;
  const imageBuffer = grayscalePng(width, height);
  const browserErrors: string[] = [];
  const uploads: Array<{ headers: Record<string, string>; bodyLength: number }> = [];

  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

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
  await page.locator('input[type="file"]').setInputFiles({
    name: "large-6000x4000.png",
    mimeType: "image/png",
    buffer: imageBuffer,
  });
  await expect(page.getByText("large-6000x4000.png")).toBeVisible();
  await expect(page.getByText("6000 x 4000")).toBeVisible();

  await page.route(/\/api\/images\/[^/]+\/mask\/upload$/, async (route, request) => {
    if (request.method() !== "POST") {
      await route.continue();
      return;
    }

    uploads.push({
      headers: request.headers(),
      bodyLength: request.postDataBuffer()?.byteLength ?? 0,
    });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        maskId: "intercepted-large-mask",
        versionId: "intercepted-large-version",
        version: 1,
        createdAt: new Date().toISOString(),
      }),
    });
  });

  await page.getByRole("link", { name: "Open editor" }).click();
  await expect(page.getByRole("button", { name: "Brush" })).toBeEnabled({ timeout: 30_000 });

  const drawingSurface = page.getByLabel("Mask drawing surface");
  await expect(drawingSurface).toBeVisible();
  await expect
    .poll(async () =>
      drawingSurface.evaluate((canvas) => ({
        width: (canvas as HTMLCanvasElement).width,
        height: (canvas as HTMLCanvasElement).height,
      })),
    )
    .toEqual({ width, height });

  await drawingSurface.scrollIntoViewIfNeeded();
  const box = await drawingSurface.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.mouse.move(box.x + box.width * 0.48, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.5, { steps: 2 });
  await page.mouse.up();

  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Save now" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 30_000 });

  expect(uploads.length).toBeGreaterThan(0);
  for (const upload of uploads) {
    expect(upload.bodyLength).toBe(expectedBytes);
    expect(upload.headers["content-type"]).toBe("application/octet-stream");
    expect(upload.headers["x-mask-width"]).toBe(String(width));
    expect(upload.headers["x-mask-height"]).toBe(String(height));
    expect(upload.headers["x-mask-format"]).toBe("u8raw-v1");
    expect(upload.headers["x-mask-byte-length"]).toBe(String(expectedBytes));
  }
  expect(browserErrors.filter((message) => /AbortError|operation was aborted/i.test(message))).toEqual([]);
});
