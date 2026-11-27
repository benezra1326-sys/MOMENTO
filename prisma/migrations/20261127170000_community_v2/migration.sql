-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'NEW_MESSAGE';
ALTER TYPE "NotificationType" ADD VALUE 'REMINDER';
ALTER TYPE "NotificationType" ADD VALUE 'RATE_MOMENT';
ALTER TYPE "NotificationType" ADD VALUE 'NEW_SOUVENIR';

-- AlterTable
ALTER TABLE "Availability" ADD COLUMN     "isAdult" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Moment" ADD COLUMN     "isAdult" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adultConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "showAdult" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "instagram" TEXT,
ADD COLUMN     "gallery" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "MomentMessage" (
    "id" TEXT NOT NULL,
    "momentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MomentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Souvenir" (
    "id" TEXT NOT NULL,
    "momentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "mediaType" "MediaType" NOT NULL DEFAULT 'TEXT',
    "mediaUrl" TEXT,
    "posterUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Souvenir_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "momentId" TEXT NOT NULL,
    "raterId" TEXT NOT NULL,
    "rateeId" TEXT NOT NULL,
    "rateeIsHost" BOOLEAN NOT NULL DEFAULT false,
    "punctuality" INTEGER NOT NULL,
    "ambiance" INTEGER NOT NULL,
    "respect" INTEGER NOT NULL,
    "organisation" INTEGER,
    "accuracy" INTEGER,
    "comment" TEXT NOT NULL DEFAULT '',
    "noShow" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MomentMessage_momentId_createdAt_idx" ON "MomentMessage"("momentId", "createdAt");

-- CreateIndex
CREATE INDEX "MomentMessage_authorId_createdAt_idx" ON "MomentMessage"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "Souvenir_momentId_createdAt_idx" ON "Souvenir"("momentId", "createdAt");

-- CreateIndex
CREATE INDEX "Rating_rateeId_idx" ON "Rating"("rateeId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_momentId_raterId_rateeId_key" ON "Rating"("momentId", "raterId", "rateeId");

-- AddForeignKey
ALTER TABLE "MomentMessage" ADD CONSTRAINT "MomentMessage_momentId_fkey" FOREIGN KEY ("momentId") REFERENCES "Moment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MomentMessage" ADD CONSTRAINT "MomentMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Souvenir" ADD CONSTRAINT "Souvenir_momentId_fkey" FOREIGN KEY ("momentId") REFERENCES "Moment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Souvenir" ADD CONSTRAINT "Souvenir_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_momentId_fkey" FOREIGN KEY ("momentId") REFERENCES "Moment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_raterId_fkey" FOREIGN KEY ("raterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_rateeId_fkey" FOREIGN KEY ("rateeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

