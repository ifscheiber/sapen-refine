/*
  Warnings:

  - You are about to drop the column `kind` on the `Mask` table. All the data in the column will be lost.
  - You are about to drop the column `dataKey` on the `MaskVersion` table. All the data in the column will be lost.
  - You are about to drop the column `note` on the `MaskVersion` table. All the data in the column will be lost.
  - You are about to drop the column `version` on the `MaskVersion` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[imageId]` on the table `Mask` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[storageKey]` on the table `MaskVersion` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Mask` table without a default value. This is not possible if the table is not empty.
  - Added the required column `height` to the `MaskVersion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kind` to the `MaskVersion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `size` to the `MaskVersion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storageKey` to the `MaskVersion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `width` to the `MaskVersion` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Mask_imageId_kind_idx";

-- DropIndex
DROP INDEX "MaskVersion_createdById_idx";

-- DropIndex
DROP INDEX "MaskVersion_maskId_version_key";

-- AlterTable
ALTER TABLE "Mask" DROP COLUMN "kind",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "MaskVersion" DROP COLUMN "dataKey",
DROP COLUMN "note",
DROP COLUMN "version",
ADD COLUMN     "format" TEXT NOT NULL DEFAULT 'u8raw-v1',
ADD COLUMN     "height" INTEGER NOT NULL,
ADD COLUMN     "kind" "MaskKind" NOT NULL,
ADD COLUMN     "size" INTEGER NOT NULL,
ADD COLUMN     "storageKey" TEXT NOT NULL,
ADD COLUMN     "width" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Mask_imageId_key" ON "Mask"("imageId");

-- CreateIndex
CREATE UNIQUE INDEX "MaskVersion_storageKey_key" ON "MaskVersion"("storageKey");

-- CreateIndex
CREATE INDEX "MaskVersion_maskId_createdAt_idx" ON "MaskVersion"("maskId", "createdAt");
