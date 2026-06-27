/*
  Warnings:

  - You are about to drop the `FoilOverride` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "FoilOverride";

-- CreateTable
CREATE TABLE "CardVariantOverride" (
    "cardId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "stock" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardVariantOverride_pkey" PRIMARY KEY ("cardId","kind")
);
