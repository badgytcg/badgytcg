-- CreateTable
CREATE TABLE "MarketPriceHistory" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketPriceHistory_cardId_source_recordedAt_idx" ON "MarketPriceHistory"("cardId", "source", "recordedAt");
