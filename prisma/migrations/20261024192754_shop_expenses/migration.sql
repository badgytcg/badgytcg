-- CreateTable
CREATE TABLE "ShopExpense" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'cards',
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "spentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopExpense_spentAt_idx" ON "ShopExpense"("spentAt");
