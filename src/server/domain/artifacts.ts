import { AnnotationArtifactKind, LabelApplicability } from "@prisma/client";

export function isSupportArtifactKind(kind: AnnotationArtifactKind): boolean {
  return (
    kind === AnnotationArtifactKind.SLICE_SUPPORT_MASK ||
    kind === AnnotationArtifactKind.INSTANCE_MASK
  );
}

export function assertSupportArtifactKind(kind: AnnotationArtifactKind): void {
  if (!isSupportArtifactKind(kind)) {
    throw new Error("ARTIFACT_NOT_SUPPORT_GEOMETRY");
  }
}

export function isSupportLabelDefinition(label: {
  stableId: string;
  applicability: LabelApplicability;
}): boolean {
  return label.stableId === "slice_support" && label.applicability === LabelApplicability.SUPPORT_MASK;
}
