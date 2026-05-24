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

test("large image enters the crop workflow and saves a crop-sized semantic mask", async ({ page }) => {
  test.setTimeout(90_000);

  const width = 6000;
  const height = 4000;
  const projectName = `E2E Large Mask ${Date.now()}`;
  const imageBuffer = grayscalePng(width, height);
  const browserErrors: string[] = [];

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

  await expect(page.getByText("Upload image", { exact: true })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "large-6000x4000.png",
    mimeType: "image/png",
    buffer: imageBuffer,
  });
  await expect(page.getByText("large-6000x4000.png")).toBeVisible();
  await expect(page.getByText("6000 x 4000")).toBeVisible();

  await expect(page.getByRole("link", { name: "Open editor" })).toHaveCount(0);
  await page.getByRole("link", { name: "Crop workflow" }).click();
  await expect(page).toHaveURL(/\/images\/[^/]+\/crop\/bboxes$/);
  const cropUrl = new URL(page.url());
  const imageId = cropUrl.pathname.match(/\/images\/([^/]+)\/crop\/bboxes$/)?.[1];
  expect(imageId).toBeTruthy();

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

  await page.mouse.move(box.x + box.width * 0.48, box.y + box.height * 0.48);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.53, box.y + box.height * 0.54, { steps: 4 });
  await page.mouse.up();

  await expect(page.getByText("BBox proposal saved")).toBeVisible();
  await page.getByRole("button", { name: "Confirm BBox set" }).click();
  await expect(page.getByText("BBox set confirmed")).toBeVisible();
  await page.getByRole("link", { name: "Continue to slice annotation" }).click();
  await expect(page).toHaveURL(/\/crop\/slices\/[^/]+\/crops\/[^/]+$/);
  await expect(page.getByRole("heading", { name: /Crop annotation editor:/ })).toBeVisible();

  const semanticSurface = page.getByLabel("Mask drawing surface");
  await expect(semanticSurface).toBeVisible();
  await semanticSurface.scrollIntoViewIfNeeded();
  const semanticBox = await semanticSurface.boundingBox();
  expect(semanticBox).not.toBeNull();
  if (!semanticBox) return;

  await page.mouse.move(semanticBox.x + semanticBox.width * 0.4, semanticBox.y + semanticBox.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(semanticBox.x + semanticBox.width * 0.6, semanticBox.y + semanticBox.height * 0.5, { steps: 6 });
  await page.mouse.up();

  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Save Sap/Heartwood semantic mask" }).click();
  await expect(page.getByText(/Classification: Sap\/Heartwood slice/)).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(async (id) => {
        const response = await fetch(`/api/images/${id}/slice-crops`, { cache: "no-store" });
        if (!response.ok) return null;
        const data = await response.json();
        const crop = data.crops?.[0];
        return crop ? crop.cropWidth * crop.cropHeight : null;
      }, imageId),
    )
    .toBeLessThan(width * height);
  expect(browserErrors.filter((message) => /AbortError|operation was aborted/i.test(message))).toEqual([]);
});
