-- CreateTable
CREATE TABLE "ScanSession" (
    "id" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "totalCards" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanSessionItem" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "cardName" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'base',
    "qty" INTEGER NOT NULL,
    "newStock" INTEGER NOT NULL,

    CONSTRAINT "ScanSessionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScanSession_createdAt_idx" ON "ScanSession"("createdAt");

-- CreateIndex
CREATE INDEX "ScanSessionItem_sessionId_idx" ON "ScanSessionItem"("sessionId");

-- AddForeignKey
ALTER TABLE "ScanSessionItem" ADD CONSTRAINT "ScanSessionItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ScanSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
