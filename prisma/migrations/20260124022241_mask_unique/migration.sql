/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `Mask` table. All the data in the column will be lost.
  - You are about to drop the column `kind` on the `MaskVersion` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[imageId,kind]` on the table `Mask` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `kind` to the `Mask` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Mask_imageId_key";

-- AlterTable
ALTER TABLE "Mask" DROP COLUMN "updatedAt",
ADD COLUMN     "kind" "MaskKind" NOT NULL;

-- AlterTable
ALTER TABLE "MaskVersion" DROP COLUMN "kind";

-- CreateIndex
CREATE INDEX "Mask_imageId_idx" ON "Mask"("imageId");

-- CreateIndex
CREATE UNIQUE INDEX "Mask_imageId_kind_key" ON "Mask"("imageId", "kind");
