-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('WEB', 'LOCAL');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "channel" "OrderChannel" NOT NULL DEFAULT 'WEB';
