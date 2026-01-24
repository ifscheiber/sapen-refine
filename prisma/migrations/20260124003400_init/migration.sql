/*
  Warnings:

  - You are about to drop the column `contentType` on the `Image` table. All the data in the column will be lost.
  - You are about to drop the column `createdById` on the `Image` table. All the data in the column will be lost.
  - You are about to drop the column `size` on the `Image` table. All the data in the column will be lost.
  - You are about to drop the column `storageKey` on the `Image` table. All the data in the column will be lost.
  - You are about to drop the `Session` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `originalKey` to the `Image` table without a default value. This is not possible if the table is not empty.
  - Made the column `filename` on table `Image` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Image" DROP CONSTRAINT "Image_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropIndex
DROP INDEX "Image_createdById_idx";

-- DropIndex
DROP INDEX "Image_projectId_idx";

-- DropIndex
DROP INDEX "Image_storageKey_key";

-- AlterTable
ALTER TABLE "Image" DROP COLUMN "contentType",
DROP COLUMN "createdById",
DROP COLUMN "size",
DROP COLUMN "storageKey",
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "originalKey" TEXT NOT NULL,
ADD COLUMN     "width" INTEGER,
ALTER COLUMN "filename" SET NOT NULL;

-- DropTable
DROP TABLE "Session";
