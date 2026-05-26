import type { AnnotationProjectRole, GlobalRole } from "@prisma/client";

export const ANNOTATOR_PROJECT_ROLE = "LABELER" satisfies AnnotationProjectRole;

export const PROJECT_READ_ROLES = ["OWNER", "QA", "LABELER", "VIEWER"] as const;
export const PROJECT_MANAGE_ROLES = ["OWNER", "QA"] as const;
export const PROJECT_ANNOTATE_ROLES = ["OWNER", "QA", "LABELER"] as const;
export const PROJECT_REVIEW_ROLES = ["OWNER", "QA"] as const;
export const PROJECT_OWNER_ROLES = ["OWNER"] as const;
export const PROJECT_OPERATION_ROLES = ["OWNER", "QA"] as const;

export type ProjectCapability =
  | "project:read"
  | "project:manage"
  | "project:uploadImage"
  | "annotation:openWorkspace"
  | "annotation:editMetadata"
  | "annotation:editBoundingBoxes"
  | "annotation:editSupportMasks"
  | "annotation:editSemanticMasks"
  | "annotation:submitOwnWork"
  | "review:approve"
  | "export:view"
  | "export:createTraining"
  | "export:downloadTraining"
  | "export:processJobs"
  | "predictionAnalysis:view"
  | "predictionAnalysis:createExport"
  | "predictionAnalysis:downloadExport"
  | "predictionImport:view"
  | "predictionImport:create"
  | "predictionImport:process"
  | "predictionRun:view"
  | "predictionRun:create"
  | "correctionTasks:view"
  | "correctionTasks:manage"
  | "correctionTasks:work";

export type GlobalCapability =
  | "admin:viewAudit"
  | "admin:cleanup"
  | "admin:createModelRun"
  | "project:create";

function hasGlobalRole(
  roles: Iterable<GlobalRole | string>,
  target: GlobalRole | string,
) {
  for (const role of roles) {
    if (role === target) return true;
  }
  return false;
}

const PROJECT_CAPABILITIES: Record<AnnotationProjectRole, ReadonlySet<ProjectCapability>> = {
  OWNER: new Set<ProjectCapability>([
    "project:read",
    "project:manage",
    "project:uploadImage",
    "annotation:openWorkspace",
    "annotation:editMetadata",
    "annotation:editBoundingBoxes",
    "annotation:editSupportMasks",
    "annotation:editSemanticMasks",
    "annotation:submitOwnWork",
    "review:approve",
    "export:view",
    "export:createTraining",
    "export:downloadTraining",
    "export:processJobs",
    "predictionAnalysis:view",
    "predictionAnalysis:createExport",
    "predictionAnalysis:downloadExport",
    "predictionImport:view",
    "predictionImport:create",
    "predictionImport:process",
    "predictionRun:view",
    "predictionRun:create",
    "correctionTasks:view",
    "correctionTasks:manage",
    "correctionTasks:work",
  ]),
  QA: new Set<ProjectCapability>([
    "project:read",
    "project:manage",
    "project:uploadImage",
    "annotation:openWorkspace",
    "annotation:editMetadata",
    "annotation:editBoundingBoxes",
    "annotation:editSupportMasks",
    "annotation:editSemanticMasks",
    "annotation:submitOwnWork",
    "review:approve",
    "export:view",
    "export:processJobs",
    "predictionAnalysis:view",
    "predictionAnalysis:createExport",
    "predictionAnalysis:downloadExport",
    "predictionImport:view",
    "predictionImport:create",
    "predictionImport:process",
    "predictionRun:view",
    "predictionRun:create",
    "correctionTasks:view",
    "correctionTasks:manage",
    "correctionTasks:work",
  ]),
  LABELER: new Set<ProjectCapability>([
    "project:read",
    "project:uploadImage",
    "annotation:openWorkspace",
    "annotation:editMetadata",
    "annotation:editBoundingBoxes",
    "annotation:editSupportMasks",
    "annotation:editSemanticMasks",
    "annotation:submitOwnWork",
  ]),
  VIEWER: new Set<ProjectCapability>([
    "project:read",
  ]),
};

export function projectCapabilitiesForRole(role: AnnotationProjectRole) {
  return PROJECT_CAPABILITIES[role];
}

export function hasProjectCapability(role: AnnotationProjectRole, capability: ProjectCapability) {
  return projectCapabilitiesForRole(role).has(capability);
}

export function isAnnotatorRole(role: AnnotationProjectRole) {
  return role === ANNOTATOR_PROJECT_ROLE;
}

export function canCreateProjectFromContext({
  globalRoles,
  projectRoles,
}: {
  globalRoles: Iterable<GlobalRole | string>;
  projectRoles: Iterable<AnnotationProjectRole | string>;
}) {
  if (hasGlobalRole(globalRoles, "ADMIN")) return true;
  for (const role of projectRoles) {
    if (role === "OWNER") return true;
  }
  return false;
}

export function hasGlobalCapability(
  roles: Iterable<GlobalRole | string>,
  capability: GlobalCapability,
) {
  if (capability === "project:create") return canCreateProjectFromContext({ globalRoles: roles, projectRoles: [] });
  return hasGlobalRole(roles, "ADMIN");
}

export function canReadProject(role: AnnotationProjectRole) {
  return hasProjectCapability(role, "project:read");
}

export function canManageProject(role: AnnotationProjectRole) {
  return hasProjectCapability(role, "project:manage");
}

export function canUploadImage(role: AnnotationProjectRole) {
  return hasProjectCapability(role, "project:uploadImage");
}

export function canEditMetadata(role: AnnotationProjectRole) {
  return hasProjectCapability(role, "annotation:editMetadata");
}

export function canAnnotate(role: AnnotationProjectRole) {
  return hasProjectCapability(role, "annotation:openWorkspace");
}

export function canSubmitReview(role: AnnotationProjectRole) {
  return hasProjectCapability(role, "annotation:submitOwnWork");
}

export function canReview(role: AnnotationProjectRole) {
  return hasProjectCapability(role, "review:approve");
}

export function canExportTraining(role: AnnotationProjectRole) {
  return hasProjectCapability(role, "export:createTraining");
}

export function canProcessExportJobs(role: AnnotationProjectRole) {
  return hasProjectCapability(role, "export:processJobs");
}

export function canViewProjectExports(role: AnnotationProjectRole) {
  return hasProjectCapability(role, "export:view");
}

export function canExportPredictionAnalysis(role: AnnotationProjectRole) {
  return hasProjectCapability(role, "predictionAnalysis:createExport");
}

export function canViewPredictionAnalysis(role: AnnotationProjectRole) {
  return hasProjectCapability(role, "predictionAnalysis:view");
}

export function canViewPredictionRuns(role: AnnotationProjectRole) {
  return hasProjectCapability(role, "predictionRun:view");
}

export function canCreatePredictionRun(role: AnnotationProjectRole) {
  return hasProjectCapability(role, "predictionRun:create");
}

export function canImportPrediction(role: AnnotationProjectRole) {
  return hasProjectCapability(role, "predictionImport:create");
}

export function canViewPredictionImports(role: AnnotationProjectRole) {
  return hasProjectCapability(role, "predictionImport:view");
}

export function canManageCorrectionTasks(role: AnnotationProjectRole) {
  return hasProjectCapability(role, "correctionTasks:manage");
}

export function canViewCorrectionTasks(role: AnnotationProjectRole) {
  return hasProjectCapability(role, "correctionTasks:view");
}

export function canWorkOnCorrectionTask(role: AnnotationProjectRole) {
  return hasProjectCapability(role, "correctionTasks:work");
}

export function canProcessPredictionBatch(role: AnnotationProjectRole) {
  return hasProjectCapability(role, "predictionImport:process");
}

export function canCreateModelRun(globalRoles: Iterable<GlobalRole | string>) {
  return hasGlobalRole(globalRoles, "ADMIN");
}

export function canViewAudit(globalRoles: Iterable<GlobalRole | string>) {
  return hasGlobalRole(globalRoles, "ADMIN");
}
