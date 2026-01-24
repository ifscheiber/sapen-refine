/*
  Warnings:

  - A unique constraint covering the columns `[maskId,version]` on the table `MaskVersion` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `version` to the `MaskVersion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MaskVersion" ADD COLUMN     "version" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "MaskVersion_createdById_idx" ON "MaskVersion"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "MaskVersion_maskId_version_key" ON "MaskVersion"("maskId", "version");
