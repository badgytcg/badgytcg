-- CreateTable
CREATE TABLE "FoilOverride" (
    "cardId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "stock" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoilOverride_pkey" PRIMARY KEY ("cardId")
);

-- CreateTable
CREATE TABLE "SpecialCard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "grade" TEXT,
    "set" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecialCard_pkey" PRIMARY KEY ("id")
);
