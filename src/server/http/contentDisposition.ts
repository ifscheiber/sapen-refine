type ContentDispositionType = "attachment" | "inline";

function encodeRFC5987Value(value: string) {
  return encodeURIComponent(value).replace(/['()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

export function sanitizeContentDispositionFilename(filename: string | null | undefined, fallback = "download.bin") {
  const fallbackName = fallback.trim() || "download.bin";
  const raw = typeof filename === "string" ? filename : "";
  const sanitized = raw
    .replace(/[\\/]+/g, "_")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized || fallbackName;
}

function asciiFallbackFilename(filename: string, fallback: string) {
  const ascii = filename
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "_")
    .trim();
  return ascii || fallback;
}

function quotedString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function contentDispositionHeader(
  disposition: ContentDispositionType,
  filename: string | null | undefined,
  fallback = "download.bin",
) {
  const safeFilename = sanitizeContentDispositionFilename(filename, fallback);
  const fallbackFilename = asciiFallbackFilename(safeFilename, fallback);
  return `${disposition}; filename="${quotedString(fallbackFilename)}"; filename*=UTF-8''${encodeRFC5987Value(safeFilename)}`;
}

export function attachmentContentDisposition(filename: string | null | undefined, fallback = "download.bin") {
  return contentDispositionHeader("attachment", filename, fallback);
}

export function inlineContentDisposition(filename: string | null | undefined, fallback = "download.bin") {
  return contentDispositionHeader("inline", filename, fallback);
}
