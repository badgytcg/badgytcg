-- CreateTable
CREATE TABLE "CardOverride" (
    "cardId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "stock" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardOverride_pkey" PRIMARY KEY ("cardId")
);
