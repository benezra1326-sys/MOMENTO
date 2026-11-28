-- Upclose+ : abonnement et boost (ajouts uniquement)
ALTER TABLE "User" ADD COLUMN "premiumUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "premiumSource" TEXT;
ALTER TABLE "User" ADD COLUMN "premiumCancelAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "User" ADD COLUMN "stripeSubscriptionId" TEXT;
ALTER TABLE "Moment" ADD COLUMN "boostedUntil" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
CREATE UNIQUE INDEX "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");
