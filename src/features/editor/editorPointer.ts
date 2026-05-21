import type React from "react";

export function shouldIgnorePointerDown(evt: React.PointerEvent<HTMLCanvasElement>) {
  if (evt.pointerType === "mouse" && evt.button !== 0) return true;
  if (evt.pointerType !== "mouse" && !evt.isPrimary) return true;
  return false;
}

export function capturePointer(target: HTMLCanvasElement, pointerId: number) {
  try {
    target.setPointerCapture(pointerId);
  } catch {
    // Pointer capture can fail if the browser already cancelled the pointer.
  }
}

export function releasePointer(target: HTMLCanvasElement, pointerId: number) {
  try {
    if (target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
  } catch {
    // Releasing a cancelled pointer is best-effort across browsers.
  }
}
