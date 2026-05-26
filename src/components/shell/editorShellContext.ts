export type EditorImageRouteContext = {
  projectId: string;
  imageId: string;
  currentPath: string;
};

export type SortableEditorImage = {
  id: string;
  filename?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseEditorImageRoute(pathname: string): EditorImageRouteContext | null {
  const segments = pathname.split("/").filter(Boolean);
  if (
    segments.length < 6 ||
    segments[0] !== "app" ||
    segments[1] !== "projects" ||
    segments[3] !== "images"
  ) {
    return null;
  }

  const editorRoot = segments[5];
  if (editorRoot !== "crop" && editorRoot !== "slices") return null;

  return {
    projectId: safeDecode(segments[2]),
    imageId: safeDecode(segments[4]),
    currentPath: pathname,
  };
}

function timestamp(value?: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function imageSortLabel(image: SortableEditorImage) {
  return (image.filename ?? image.id).toLocaleLowerCase();
}

export function sortEditorSidebarImages<T extends SortableEditorImage>(
  images: T[],
  activeImageId: string,
): T[] {
  return [...images].sort((left, right) => {
    if (left.id === activeImageId && right.id !== activeImageId) return -1;
    if (right.id === activeImageId && left.id !== activeImageId) return 1;

    const leftTime = timestamp(left.updatedAt) || timestamp(left.createdAt);
    const rightTime = timestamp(right.updatedAt) || timestamp(right.createdAt);
    return rightTime - leftTime || imageSortLabel(left).localeCompare(imageSortLabel(right));
  });
}
