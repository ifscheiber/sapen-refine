/*
  Warnings:

  - You are about to drop the column `height` on the `Image` table. All the data in the column will be lost.
  - You are about to drop the column `originalKey` on the `Image` table. All the data in the column will be lost.
  - You are about to drop the column `width` on the `Image` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[storageKey]` on the table `Image` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `storageKey` to the `Image` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Image" DROP COLUMN "height",
DROP COLUMN "originalKey",
DROP COLUMN "width",
ADD COLUMN     "contentType" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "size" INTEGER,
ADD COLUMN     "storageKey" TEXT NOT NULL,
ALTER COLUMN "filename" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Image_storageKey_key" ON "Image"("storageKey");

-- CreateIndex
CREATE INDEX "Image_projectId_idx" ON "Image"("projectId");

-- CreateIndex
CREATE INDEX "Image_createdById_idx" ON "Image"("createdById");

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
