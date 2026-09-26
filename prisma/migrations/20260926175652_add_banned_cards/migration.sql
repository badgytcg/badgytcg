-- CreateTable
CREATE TABLE "BannedCard" (
    "cardId" TEXT NOT NULL,
    "cardName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BannedCard_pkey" PRIMARY KEY ("cardId")
);
