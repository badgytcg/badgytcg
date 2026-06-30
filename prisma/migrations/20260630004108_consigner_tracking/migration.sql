-- AlterTable
ALTER TABLE "CardOverride" ADD COLUMN     "owner" TEXT NOT NULL DEFAULT 'badgy';

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "owner" TEXT NOT NULL DEFAULT 'badgy';

-- CreateTable
CREATE TABLE "Consigner" (
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consigner_pkey" PRIMARY KEY ("slug")
);

-- Seed default consigners
INSERT INTO "Consigner" ("slug", "name") VALUES ('badgy', 'Badgy'), ('sneakerdad', 'SneakerDad') ON CONFLICT DO NOTHING;
