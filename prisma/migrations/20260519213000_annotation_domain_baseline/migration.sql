-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "AnnotationProjectRole" AS ENUM ('OWNER', 'QA', 'LABELER', 'VIEWER');

-- CreateEnum
CREATE TYPE "LabelSchemaStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DEPRECATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LabelApplicability" AS ENUM ('SEMANTIC_MASK', 'SUPPORT_MASK', 'SLICE_CLASSIFICATION', 'REVIEW_FLAG');

-- CreateEnum
CREATE TYPE "ImageValidationStatus" AS ENUM ('PENDING', 'VALIDATED', 'FAILED');

-- CreateEnum
CREATE TYPE "AnnotationTaskType" AS ENUM ('SEMANTIC_MATERIAL_MASK', 'SLICE_SUPPORT_MASK', 'SLICE_CLASSIFICATION', 'REVIEW_APPROVAL', 'MODEL_PREDICTION_CORRECTION');

-- CreateEnum
CREATE TYPE "AnnotationTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'SUBMITTED', 'BLOCKED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AnnotationArtifactKind" AS ENUM ('SEMANTIC_MASK', 'SLICE_SUPPORT_MASK', 'INSTANCE_MASK', 'PREDICTION_MASK', 'DERIVED_MASK');

-- CreateEnum
CREATE TYPE "ArtifactReviewState" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ArtifactProvenance" AS ENUM ('HUMAN_ANNOTATION', 'HUMAN_CORRECTION', 'MODEL_PREDICTION', 'DERIVED', 'SYSTEM_IMPORT');

-- CreateEnum
CREATE TYPE "CoordinateSpace" AS ENUM ('IMAGE_PIXEL', 'TRANSFORMED');

-- CreateEnum
CREATE TYPE "SliceClass" AS ENUM ('SAP_HEARTWOOD_SLICE', 'COPPER_SLICE', 'UNKNOWN', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "ExportTarget" AS ENUM ('SEMANTIC_SEGMENTATION', 'INSTANCE_SUPPORT_SEGMENTATION', 'SLICE_CLASSIFICATION', 'COMBINED_MANIFEST');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('CREATED', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" "GlobalRole" NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGlobalRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserGlobalRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "AnnotationProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "labelSchemaVersionId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnotationProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnotationProjectMember" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AnnotationProjectRole" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnotationProjectMember_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateTable
CREATE TABLE "LabelSchemaVersion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "LabelSchemaStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabelSchemaVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabelDefinition" (
    "id" TEXT NOT NULL,
    "schemaVersionId" TEXT NOT NULL,
    "stableId" TEXT NOT NULL,
    "byteValue" INTEGER,
    "displayName" TEXT NOT NULL,
    "semanticMeaning" TEXT NOT NULL,
    "applicability" "LabelApplicability" NOT NULL,
    "colorToken" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isTrainable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabelDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageAsset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT,
    "contentType" TEXT,
    "size" INTEGER,
    "checksum" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "validationStatus" "ImageValidationStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageAcquisitionMetadata" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "cameraDevice" TEXT,
    "lensObjective" TEXT,
    "exposure" TEXT,
    "aperture" TEXT,
    "iso" TEXT,
    "whiteBalance" TEXT,
    "colorProfile" TEXT,
    "lightingSetup" TEXT,
    "capturedBy" TEXT,
    "capturedAt" TIMESTAMP(3),
    "importedExif" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageAcquisitionMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SampleMetadata" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "tNumber" TEXT,
    "specimenIdentifier" TEXT,
    "sliceIndex" INTEGER,
    "replicate" TEXT,
    "treatmentReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SampleMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnotationTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "imageId" TEXT,
    "sliceInstanceId" TEXT,
    "type" "AnnotationTaskType" NOT NULL,
    "status" "AnnotationTaskStatus" NOT NULL DEFAULT 'OPEN',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "taskReason" TEXT,
    "uncertaintyScore" DOUBLE PRECISION,
    "confidenceScore" DOUBLE PRECISION,
    "modelSource" TEXT,
    "sourceArtifactVersionId" TEXT,
    "createdById" TEXT,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnotationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnotationSession" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "imageId" TEXT,
    "taskId" TEXT,
    "actorId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMP(3),
    "clientVersion" TEXT,
    "toolMode" TEXT,
    "auditContext" JSONB,

    CONSTRAINT "AnnotationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnotationArtifact" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "kind" "AnnotationArtifactKind" NOT NULL,
    "scopeKey" TEXT NOT NULL DEFAULT 'default',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnotationArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnotationArtifactVersion" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "reviewState" "ArtifactReviewState" NOT NULL DEFAULT 'DRAFT',
    "provenance" "ArtifactProvenance" NOT NULL DEFAULT 'HUMAN_ANNOTATION',
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT,
    "size" INTEGER NOT NULL,
    "checksum" TEXT,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "coordinateSpace" "CoordinateSpace" NOT NULL DEFAULT 'IMAGE_PIXEL',
    "coordinateTransform" JSONB,
    "format" TEXT NOT NULL DEFAULT 'u8raw-v1',
    "labelSchemaVersionId" TEXT NOT NULL,
    "taskId" TEXT,
    "sessionId" TEXT,
    "parentVersionId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnotationArtifactVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SliceInstance" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "supportArtifactVersionId" TEXT,
    "boundingBox" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SliceInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SliceClassificationVersion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "sliceInstanceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "class" "SliceClass" NOT NULL,
    "labelSchemaVersionId" TEXT NOT NULL,
    "reviewState" "ArtifactReviewState" NOT NULL DEFAULT 'DRAFT',
    "taskId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SliceClassificationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewDecision" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "artifactVersionId" TEXT NOT NULL,
    "fromState" "ArtifactReviewState",
    "toState" "ArtifactReviewState" NOT NULL,
    "reviewedById" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comments" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportBatch" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "target" "ExportTarget" NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'CREATED',
    "manifestFormatVersion" TEXT NOT NULL DEFAULT 'sapen-annotate-manifest-v1',
    "manifestStorageKey" TEXT,
    "manifestChecksum" TEXT,
    "selectionCriteria" JSONB,
    "warnings" JSONB,
    "metadataSummary" JSONB,
    "exportedById" TEXT NOT NULL,
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportItem" (
    "id" TEXT NOT NULL,
    "exportBatchId" TEXT NOT NULL,
    "imageId" TEXT,
    "artifactVersionId" TEXT,
    "sliceClassificationVersionId" TEXT,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "AnnotationProject_labelSchemaVersionId_idx" ON "AnnotationProject"("labelSchemaVersionId");

-- CreateIndex
CREATE INDEX "AnnotationProject_createdById_idx" ON "AnnotationProject"("createdById");

-- CreateIndex
CREATE INDEX "AnnotationProjectMember_userId_idx" ON "AnnotationProjectMember"("userId");

-- CreateIndex
CREATE INDEX "AnnotationProjectMember_role_idx" ON "AnnotationProjectMember"("role");

-- CreateIndex
CREATE INDEX "LabelSchemaVersion_isDefault_status_idx" ON "LabelSchemaVersion"("isDefault", "status");

-- CreateIndex
CREATE INDEX "LabelSchemaVersion_createdById_idx" ON "LabelSchemaVersion"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "LabelSchemaVersion_name_version_key" ON "LabelSchemaVersion"("name", "version");

-- CreateIndex
CREATE INDEX "LabelDefinition_schemaVersionId_applicability_idx" ON "LabelDefinition"("schemaVersionId", "applicability");

-- CreateIndex
CREATE UNIQUE INDEX "LabelDefinition_schemaVersionId_stableId_key" ON "LabelDefinition"("schemaVersionId", "stableId");

-- CreateIndex
CREATE UNIQUE INDEX "LabelDefinition_schemaVersionId_byteValue_key" ON "LabelDefinition"("schemaVersionId", "byteValue");

-- CreateIndex
CREATE UNIQUE INDEX "ImageAsset_storageKey_key" ON "ImageAsset"("storageKey");

-- CreateIndex
CREATE INDEX "ImageAsset_projectId_idx" ON "ImageAsset"("projectId");

-- CreateIndex
CREATE INDEX "ImageAsset_uploadedById_idx" ON "ImageAsset"("uploadedById");

-- CreateIndex
CREATE INDEX "ImageAsset_validationStatus_idx" ON "ImageAsset"("validationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ImageAcquisitionMetadata_imageId_key" ON "ImageAcquisitionMetadata"("imageId");

-- CreateIndex
CREATE UNIQUE INDEX "SampleMetadata_imageId_key" ON "SampleMetadata"("imageId");

-- CreateIndex
CREATE INDEX "AnnotationTask_projectId_status_idx" ON "AnnotationTask"("projectId", "status");

-- CreateIndex
CREATE INDEX "AnnotationTask_imageId_idx" ON "AnnotationTask"("imageId");

-- CreateIndex
CREATE INDEX "AnnotationTask_assigneeId_status_idx" ON "AnnotationTask"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "AnnotationTask_type_idx" ON "AnnotationTask"("type");

-- CreateIndex
CREATE INDEX "AnnotationSession_projectId_startedAt_idx" ON "AnnotationSession"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "AnnotationSession_imageId_idx" ON "AnnotationSession"("imageId");

-- CreateIndex
CREATE INDEX "AnnotationSession_taskId_idx" ON "AnnotationSession"("taskId");

-- CreateIndex
CREATE INDEX "AnnotationSession_actorId_idx" ON "AnnotationSession"("actorId");

-- CreateIndex
CREATE INDEX "AnnotationArtifact_projectId_kind_idx" ON "AnnotationArtifact"("projectId", "kind");

-- CreateIndex
CREATE INDEX "AnnotationArtifact_createdById_idx" ON "AnnotationArtifact"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "AnnotationArtifact_imageId_kind_scopeKey_key" ON "AnnotationArtifact"("imageId", "kind", "scopeKey");

-- CreateIndex
CREATE UNIQUE INDEX "AnnotationArtifactVersion_storageKey_key" ON "AnnotationArtifactVersion"("storageKey");

-- CreateIndex
CREATE INDEX "AnnotationArtifactVersion_artifactId_createdAt_idx" ON "AnnotationArtifactVersion"("artifactId", "createdAt");

-- CreateIndex
CREATE INDEX "AnnotationArtifactVersion_labelSchemaVersionId_idx" ON "AnnotationArtifactVersion"("labelSchemaVersionId");

-- CreateIndex
CREATE INDEX "AnnotationArtifactVersion_reviewState_idx" ON "AnnotationArtifactVersion"("reviewState");

-- CreateIndex
CREATE INDEX "AnnotationArtifactVersion_createdById_idx" ON "AnnotationArtifactVersion"("createdById");

-- CreateIndex
CREATE INDEX "AnnotationArtifactVersion_parentVersionId_idx" ON "AnnotationArtifactVersion"("parentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnotationArtifactVersion_artifactId_version_key" ON "AnnotationArtifactVersion"("artifactId", "version");

-- CreateIndex
CREATE INDEX "SliceInstance_projectId_idx" ON "SliceInstance"("projectId");

-- CreateIndex
CREATE INDEX "SliceInstance_imageId_idx" ON "SliceInstance"("imageId");

-- CreateIndex
CREATE INDEX "SliceInstance_supportArtifactVersionId_idx" ON "SliceInstance"("supportArtifactVersionId");

-- CreateIndex
CREATE INDEX "SliceInstance_createdById_idx" ON "SliceInstance"("createdById");

-- CreateIndex
CREATE INDEX "SliceClassificationVersion_projectId_class_idx" ON "SliceClassificationVersion"("projectId", "class");

-- CreateIndex
CREATE INDEX "SliceClassificationVersion_imageId_idx" ON "SliceClassificationVersion"("imageId");

-- CreateIndex
CREATE INDEX "SliceClassificationVersion_reviewState_idx" ON "SliceClassificationVersion"("reviewState");

-- CreateIndex
CREATE INDEX "SliceClassificationVersion_labelSchemaVersionId_idx" ON "SliceClassificationVersion"("labelSchemaVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "SliceClassificationVersion_sliceInstanceId_version_key" ON "SliceClassificationVersion"("sliceInstanceId", "version");

-- CreateIndex
CREATE INDEX "ReviewDecision_projectId_reviewedAt_idx" ON "ReviewDecision"("projectId", "reviewedAt");

-- CreateIndex
CREATE INDEX "ReviewDecision_artifactVersionId_idx" ON "ReviewDecision"("artifactVersionId");

-- CreateIndex
CREATE INDEX "ReviewDecision_reviewedById_idx" ON "ReviewDecision"("reviewedById");

-- CreateIndex
CREATE INDEX "ReviewDecision_toState_idx" ON "ReviewDecision"("toState");

-- CreateIndex
CREATE INDEX "ExportBatch_projectId_exportedAt_idx" ON "ExportBatch"("projectId", "exportedAt");

-- CreateIndex
CREATE INDEX "ExportBatch_exportedById_idx" ON "ExportBatch"("exportedById");

-- CreateIndex
CREATE INDEX "ExportBatch_target_status_idx" ON "ExportBatch"("target", "status");

-- CreateIndex
CREATE INDEX "ExportItem_exportBatchId_idx" ON "ExportItem"("exportBatchId");

-- CreateIndex
CREATE INDEX "ExportItem_imageId_idx" ON "ExportItem"("imageId");

-- CreateIndex
CREATE INDEX "ExportItem_artifactVersionId_idx" ON "ExportItem"("artifactVersionId");

-- CreateIndex
CREATE INDEX "ExportItem_sliceClassificationVersionId_idx" ON "ExportItem"("sliceClassificationVersionId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- AddForeignKey
ALTER TABLE "UserGlobalRole" ADD CONSTRAINT "UserGlobalRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGlobalRole" ADD CONSTRAINT "UserGlobalRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationProject" ADD CONSTRAINT "AnnotationProject_labelSchemaVersionId_fkey" FOREIGN KEY ("labelSchemaVersionId") REFERENCES "LabelSchemaVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationProject" ADD CONSTRAINT "AnnotationProject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationProjectMember" ADD CONSTRAINT "AnnotationProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AnnotationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationProjectMember" ADD CONSTRAINT "AnnotationProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabelSchemaVersion" ADD CONSTRAINT "LabelSchemaVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabelDefinition" ADD CONSTRAINT "LabelDefinition_schemaVersionId_fkey" FOREIGN KEY ("schemaVersionId") REFERENCES "LabelSchemaVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageAsset" ADD CONSTRAINT "ImageAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AnnotationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageAsset" ADD CONSTRAINT "ImageAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageAcquisitionMetadata" ADD CONSTRAINT "ImageAcquisitionMetadata_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ImageAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleMetadata" ADD CONSTRAINT "SampleMetadata_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ImageAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationTask" ADD CONSTRAINT "AnnotationTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AnnotationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationTask" ADD CONSTRAINT "AnnotationTask_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ImageAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationTask" ADD CONSTRAINT "AnnotationTask_sliceInstanceId_fkey" FOREIGN KEY ("sliceInstanceId") REFERENCES "SliceInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationTask" ADD CONSTRAINT "AnnotationTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationTask" ADD CONSTRAINT "AnnotationTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationSession" ADD CONSTRAINT "AnnotationSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AnnotationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationSession" ADD CONSTRAINT "AnnotationSession_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ImageAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationSession" ADD CONSTRAINT "AnnotationSession_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AnnotationTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationSession" ADD CONSTRAINT "AnnotationSession_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationArtifact" ADD CONSTRAINT "AnnotationArtifact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AnnotationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationArtifact" ADD CONSTRAINT "AnnotationArtifact_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ImageAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationArtifact" ADD CONSTRAINT "AnnotationArtifact_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationArtifactVersion" ADD CONSTRAINT "AnnotationArtifactVersion_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "AnnotationArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationArtifactVersion" ADD CONSTRAINT "AnnotationArtifactVersion_labelSchemaVersionId_fkey" FOREIGN KEY ("labelSchemaVersionId") REFERENCES "LabelSchemaVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationArtifactVersion" ADD CONSTRAINT "AnnotationArtifactVersion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AnnotationTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationArtifactVersion" ADD CONSTRAINT "AnnotationArtifactVersion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AnnotationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationArtifactVersion" ADD CONSTRAINT "AnnotationArtifactVersion_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "AnnotationArtifactVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationArtifactVersion" ADD CONSTRAINT "AnnotationArtifactVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SliceInstance" ADD CONSTRAINT "SliceInstance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AnnotationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SliceInstance" ADD CONSTRAINT "SliceInstance_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ImageAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SliceInstance" ADD CONSTRAINT "SliceInstance_supportArtifactVersionId_fkey" FOREIGN KEY ("supportArtifactVersionId") REFERENCES "AnnotationArtifactVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SliceInstance" ADD CONSTRAINT "SliceInstance_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SliceClassificationVersion" ADD CONSTRAINT "SliceClassificationVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AnnotationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SliceClassificationVersion" ADD CONSTRAINT "SliceClassificationVersion_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ImageAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SliceClassificationVersion" ADD CONSTRAINT "SliceClassificationVersion_sliceInstanceId_fkey" FOREIGN KEY ("sliceInstanceId") REFERENCES "SliceInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SliceClassificationVersion" ADD CONSTRAINT "SliceClassificationVersion_labelSchemaVersionId_fkey" FOREIGN KEY ("labelSchemaVersionId") REFERENCES "LabelSchemaVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SliceClassificationVersion" ADD CONSTRAINT "SliceClassificationVersion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AnnotationTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SliceClassificationVersion" ADD CONSTRAINT "SliceClassificationVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AnnotationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_artifactVersionId_fkey" FOREIGN KEY ("artifactVersionId") REFERENCES "AnnotationArtifactVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportBatch" ADD CONSTRAINT "ExportBatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AnnotationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportBatch" ADD CONSTRAINT "ExportBatch_exportedById_fkey" FOREIGN KEY ("exportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportItem" ADD CONSTRAINT "ExportItem_exportBatchId_fkey" FOREIGN KEY ("exportBatchId") REFERENCES "ExportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportItem" ADD CONSTRAINT "ExportItem_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ImageAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportItem" ADD CONSTRAINT "ExportItem_artifactVersionId_fkey" FOREIGN KEY ("artifactVersionId") REFERENCES "AnnotationArtifactVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportItem" ADD CONSTRAINT "ExportItem_sliceClassificationVersionId_fkey" FOREIGN KEY ("sliceClassificationVersionId") REFERENCES "SliceClassificationVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
