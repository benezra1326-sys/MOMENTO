-- Notes façon « après la course » : étoiles, qualités en un geste, « tu le referais ? »
ALTER TABLE "Rating" ADD COLUMN "stars" INTEGER;
ALTER TABLE "Rating" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Rating" ADD COLUMN "again" BOOLEAN;

-- Certification de la photo de profil par selfie en direct
ALTER TABLE "User" ADD COLUMN "photoVerifiedAt" TIMESTAMP(3);

CREATE TABLE "PhotoVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "selfieUrl" TEXT NOT NULL,
    "gesture" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    CONSTRAINT "PhotoVerification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PhotoVerification_userId_createdAt_idx" ON "PhotoVerification"("userId", "createdAt");
CREATE INDEX "PhotoVerification_status_idx" ON "PhotoVerification"("status");
ALTER TABLE "PhotoVerification" ADD CONSTRAINT "PhotoVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TYPE "NotificationType" ADD VALUE 'PHOTO_VERIFIED';
