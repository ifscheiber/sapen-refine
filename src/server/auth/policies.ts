import type { AnnotationProjectRole, GlobalRole } from "@prisma/client";

export const PROJECT_READ_ROLES = ["OWNER", "QA", "LABELER", "VIEWER"] as const;
export const PROJECT_MANAGE_ROLES = ["OWNER", "QA"] as const;
export const PROJECT_ANNOTATE_ROLES = ["OWNER", "QA", "LABELER"] as const;
export const PROJECT_REVIEW_ROLES = ["OWNER", "QA"] as const;
export const PROJECT_OWNER_ROLES = ["OWNER"] as const;

type ProjectRoleList = readonly AnnotationProjectRole[];

function hasProjectRole(role: AnnotationProjectRole, roles: ProjectRoleList) {
  return roles.includes(role);
}

function hasGlobalRole(
  roles: Iterable<GlobalRole | string>,
  target: GlobalRole | string,
) {
  for (const role of roles) {
    if (role === target) return true;
  }
  return false;
}

export function canReadProject(role: AnnotationProjectRole) {
  return hasProjectRole(role, PROJECT_READ_ROLES);
}

export function canManageProject(role: AnnotationProjectRole) {
  return hasProjectRole(role, PROJECT_MANAGE_ROLES);
}

export function canUploadImage(role: AnnotationProjectRole) {
  return hasProjectRole(role, PROJECT_ANNOTATE_ROLES);
}

export function canEditMetadata(role: AnnotationProjectRole) {
  return hasProjectRole(role, PROJECT_ANNOTATE_ROLES);
}

export function canAnnotate(role: AnnotationProjectRole) {
  return hasProjectRole(role, PROJECT_ANNOTATE_ROLES);
}

export function canSubmitReview(role: AnnotationProjectRole) {
  return hasProjectRole(role, PROJECT_ANNOTATE_ROLES);
}

export function canReview(role: AnnotationProjectRole) {
  return hasProjectRole(role, PROJECT_REVIEW_ROLES);
}

export function canExportTraining(role: AnnotationProjectRole) {
  return hasProjectRole(role, PROJECT_OWNER_ROLES);
}

export function canExportPredictionAnalysis(role: AnnotationProjectRole) {
  return hasProjectRole(role, PROJECT_MANAGE_ROLES);
}

export function canCreatePredictionRun(role: AnnotationProjectRole) {
  return hasProjectRole(role, PROJECT_MANAGE_ROLES);
}

export function canImportPrediction(role: AnnotationProjectRole) {
  return hasProjectRole(role, PROJECT_MANAGE_ROLES);
}

export function canManageCorrectionTasks(role: AnnotationProjectRole) {
  return hasProjectRole(role, PROJECT_MANAGE_ROLES);
}

export function canWorkOnCorrectionTask(role: AnnotationProjectRole) {
  return hasProjectRole(role, PROJECT_ANNOTATE_ROLES);
}

export function canProcessPredictionBatch(role: AnnotationProjectRole) {
  return hasProjectRole(role, PROJECT_MANAGE_ROLES);
}

export function canCreateModelRun(globalRoles: Iterable<GlobalRole | string>) {
  return hasGlobalRole(globalRoles, "ADMIN");
}

export function canViewAudit(globalRoles: Iterable<GlobalRole | string>) {
  return hasGlobalRole(globalRoles, "ADMIN");
}
