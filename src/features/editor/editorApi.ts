export const API_IMAGE_VIEW = (imageId: string) => `/api/images/${imageId}/view`;
export const API_MASK_LATEST = (imageId: string) => `/api/images/${imageId}/mask/latest`;
export const API_MASK_UPLOAD = (imageId: string) => `/api/images/${imageId}/mask/upload`;
export const API_SUPPORT_MASK_LATEST = (imageId: string) => `/api/images/${imageId}/support-mask/latest`;
export const API_SUPPORT_MASK_UPLOAD = (imageId: string) => `/api/images/${imageId}/support-mask/upload`;
export const API_SLICE_STATE = (imageId: string) => `/api/images/${imageId}/slice`;
export const API_SLICE_BBOXES = (imageId: string) => `/api/images/${imageId}/slice-bboxes`;
export const API_SLICE_BBOX = (bboxVersionId: string) => `/api/slice-bboxes/${bboxVersionId}`;
export const API_SLICE_CLASSIFICATION = (imageId: string) => `/api/images/${imageId}/slice/classification`;
export const API_REVIEW_STATE = (imageId: string) => `/api/images/${imageId}/review-state`;
export const API_ARTIFACT_REVIEW = (versionId: string) => `/api/artifact-versions/${versionId}/review`;
export const API_CLASSIFICATION_REVIEW = (versionId: string) =>
  `/api/slice-classification-versions/${versionId}/review`;
export const API_CORRECTION_CONTEXT = (taskId: string) => `/api/correction-tasks/${taskId}/correction-context`;
