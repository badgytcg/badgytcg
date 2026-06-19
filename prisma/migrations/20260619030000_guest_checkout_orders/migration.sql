-- Drop the existing FK so we can make userId nullable and change the delete behavior
ALTER TABLE "Order" DROP CONSTRAINT "Order_userId_fkey";

-- Make userId optional (guest checkouts have no account) and add guest/stripe fields
ALTER TABLE "Order" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Order" ADD COLUMN "guestEmail" TEXT;
ALTER TABLE "Order" ADD COLUMN "stripeSessionId" TEXT NOT NULL DEFAULT '';

-- Recreate the FK with SET NULL instead of CASCADE, since deleting a user
-- shouldn't delete their purchase history
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop the temporary default now that the column exists, then enforce uniqueness
ALTER TABLE "Order" ALTER COLUMN "stripeSessionId" DROP DEFAULT;
CREATE UNIQUE INDEX "Order_stripeSessionId_key" ON "Order"("stripeSessionId");
