export const API_IMAGE_VIEW = (imageId: string) => `/api/images/${imageId}/view`;
export const API_MASK_LATEST = (imageId: string) => `/api/images/${imageId}/mask/latest`;
export const API_MASK_UPLOAD = (imageId: string) => `/api/images/${imageId}/mask/upload`;
export const API_SUPPORT_MASK_LATEST = (imageId: string) => `/api/images/${imageId}/support-mask/latest`;
export const API_SUPPORT_MASK_UPLOAD = (imageId: string) => `/api/images/${imageId}/support-mask/upload`;
export const API_SLICE_STATE = (imageId: string) => `/api/images/${imageId}/slice`;
export const API_SLICE_BBOXES = (imageId: string) => `/api/images/${imageId}/slice-bboxes`;
export const API_CONFIRM_SLICE_BBOX_SET = (imageId: string) =>
  `/api/images/${imageId}/slice-bboxes/confirm`;
export const API_SLICE_BBOX = (bboxVersionId: string) => `/api/slice-bboxes/${bboxVersionId}`;
export const API_SLICE_CROPS = (imageId: string) => `/api/images/${imageId}/slice-crops`;
export const API_ENSURE_SLICE_CROPS = (imageId: string) => `/api/images/${imageId}/slice-crops/ensure`;
export const API_PROJECT_CROP_READINESS = (
  projectId: string,
  params?: { imageId?: string; sliceInstanceId?: string },
) => {
  const search = new URLSearchParams();
  if (params?.imageId) search.set("imageId", params.imageId);
  if (params?.sliceInstanceId) search.set("sliceInstanceId", params.sliceInstanceId);
  const query = search.toString();
  return `/api/projects/${projectId}/crop-readiness${query ? `?${query}` : ""}`;
};
export const API_GENERATE_SLICE_CROP = (bboxVersionId: string) => `/api/slice-bboxes/${bboxVersionId}/crop`;
export const API_CROP_SUPPORT_MASK = (cropId: string) => `/api/slice-crops/${cropId}/support-mask`;
export const API_CROP_SUPPORT_MASK_UPLOAD = (cropId: string) =>
  `/api/slice-crops/${cropId}/support-mask/upload`;
export const API_CROP_SEMANTIC_MASK = (cropId: string) => `/api/slice-crops/${cropId}/semantic-mask`;
export const API_CROP_SEMANTIC_MASK_UPLOAD = (cropId: string) =>
  `/api/slice-crops/${cropId}/semantic-mask/upload`;
export const API_SLICE_CLASSIFICATION = (imageId: string) => `/api/images/${imageId}/slice/classification`;
export const API_SLICE_INSTANCE_CLASSIFICATION = (sliceInstanceId: string) =>
  `/api/slices/${sliceInstanceId}/classification`;
export const API_REVIEW_STATE = (imageId: string) => `/api/images/${imageId}/review-state`;
export const API_ARTIFACT_REVIEW = (versionId: string) => `/api/artifact-versions/${versionId}/review`;
export const API_CLASSIFICATION_REVIEW = (versionId: string) =>
  `/api/slice-classification-versions/${versionId}/review`;
export const API_CORRECTION_CONTEXT = (taskId: string) => `/api/correction-tasks/${taskId}/correction-context`;
